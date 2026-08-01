use crate::quit::QuitGuard;
use crate::source_control::contracts::{
    PublicSourceControlError, PublicSourceControlErrorCode, SourceControlOperationCancelInput,
    SourceControlOperationEvent,
};
use crate::source_control::scope_registry::SourceControlScopeRecord;
use std::cell::Cell;
use std::collections::HashMap;
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use tauri::{AppHandle, Emitter};

pub struct SourceControlOperationContext {
    pub operation_id: String,
    pub repository_id: String,
    pub trunk_id: String,
    pub cancellation: Arc<AtomicBool>,
}

struct ActiveOperation {
    repository_id: String,
    cancellation: Arc<AtomicBool>,
    child_slot: Arc<Mutex<Option<Child>>>,
}

struct RepositoryQueue {
    running: Mutex<bool>,
    available: Condvar,
}

impl RepositoryQueue {
    fn acquire(self: &Arc<Self>) -> RepositoryQueuePermit {
        let mut running = self.running.lock().unwrap();
        while *running {
            running = self.available.wait(running).unwrap();
        }
        *running = true;
        RepositoryQueuePermit {
            queue: Arc::clone(self),
        }
    }
}

struct RepositoryQueuePermit {
    queue: Arc<RepositoryQueue>,
}

impl Drop for RepositoryQueuePermit {
    fn drop(&mut self) {
        let mut running = self.queue.running.lock().unwrap();
        *running = false;
        self.queue.available.notify_one();
    }
}

#[derive(Default)]
pub struct SourceControlOperationCoordinatorState {
    repo_queues: Mutex<HashMap<String, Arc<RepositoryQueue>>>,
    operations: Mutex<HashMap<String, ActiveOperation>>,
    pending_counts: Mutex<HashMap<String, usize>>,
}

impl SourceControlOperationCoordinatorState {
    fn repo_queue(&self, repository_id: &str) -> Arc<RepositoryQueue> {
        let mut queues = self.repo_queues.lock().unwrap();
        queues
            .entry(repository_id.to_string())
            .or_insert_with(|| Arc::new(RepositoryQueue {
                running: Mutex::new(false),
                available: Condvar::new(),
            }))
            .clone()
    }

    pub fn child_slot(&self, operation_id: &str) -> Option<Arc<Mutex<Option<Child>>>> {
        self.operations
            .lock()
            .unwrap()
            .get(operation_id)
            .map(|active| active.child_slot.clone())
    }

    pub fn begin<'a>(
        &'a self,
        scope: &SourceControlScopeRecord,
        app: Option<&AppHandle>,
        quit: &'a QuitGuard,
        phase: &'static str,
    ) -> Result<SourceControlOperationGuard<'a>, PublicSourceControlError> {
        let repository_id = scope
            .repository_identity
            .clone()
            .unwrap_or_else(|| scope.checkout_identity.clone());
        let operation_id = uuid::Uuid::new_v4().to_string();
        let cancellation = Arc::new(AtomicBool::new(false));
        let repo_permit = self.repo_queue(&repository_id).acquire();

        {
            let mut counts = self.pending_counts.lock().unwrap();
            *counts.entry(repository_id.clone()).or_insert(0) += 1;
        }
        quit.begin_operation();

        self.operations.lock().unwrap().insert(
            operation_id.clone(),
            ActiveOperation {
                repository_id: repository_id.clone(),
                cancellation: cancellation.clone(),
                child_slot: Arc::new(Mutex::new(None)),
            },
        );

        emit_event(
            app,
            SourceControlOperationEvent::Started {
                operation_id: operation_id.clone(),
                repository_id: repository_id.clone(),
                trunk_id: scope.trunk_id.clone(),
                phase: phase.to_string(),
                cancellable: true,
            },
        );

        Ok(SourceControlOperationGuard {
            coordinator: self,
            context: SourceControlOperationContext {
                operation_id,
                repository_id,
                trunk_id: scope.trunk_id.clone(),
                cancellation,
            },
            app: app.cloned(),
            quit,
            repo_permit,
            terminal_emitted: Cell::new(false),
        })
    }

    pub fn cancel(&self, operation_id: &str) -> Result<(), PublicSourceControlError> {
        let operations = self.operations.lock().unwrap();
        let Some(active) = operations.get(operation_id) else {
            return Err(PublicSourceControlError::not_found("cancel"));
        };
        active.cancellation.store(true, Ordering::SeqCst);
        if let Ok(mut child) = active.child_slot.lock() {
            if let Some(mut child) = child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        Ok(())
    }

    fn finish_operation(&self, operation_id: &str) -> Option<String> {
        self.operations
            .lock()
            .unwrap()
            .remove(operation_id)
            .map(|active| active.repository_id)
    }

    fn decrement_pending(&self, repository_id: &str) {
        let mut counts = self.pending_counts.lock().unwrap();
        if let Some(count) = counts.get_mut(repository_id) {
            *count = count.saturating_sub(1);
        }
    }

    pub fn pending_count(&self, repository_id: &str) -> usize {
        self.pending_counts
            .lock()
            .unwrap()
            .get(repository_id)
            .copied()
            .unwrap_or(0)
    }

    pub fn active_operation_ids(&self) -> Vec<String> {
        self.operations.lock().unwrap().keys().cloned().collect()
    }
}

pub struct SourceControlOperationGuard<'a> {
    coordinator: &'a SourceControlOperationCoordinatorState,
    context: SourceControlOperationContext,
    app: Option<AppHandle>,
    quit: &'a QuitGuard,
    repo_permit: RepositoryQueuePermit,
    terminal_emitted: Cell<bool>,
}

impl SourceControlOperationGuard<'_> {
    pub fn context(&self) -> &SourceControlOperationContext {
        &self.context
    }

    pub fn complete(mut self, result_summary: impl Into<String>) {
        self.emit_terminal(SourceControlOperationEvent::Completed {
            operation_id: self.context.operation_id.clone(),
            repository_id: self.context.repository_id.clone(),
            trunk_id: self.context.trunk_id.clone(),
            result_summary: result_summary.into(),
        });
    }

    pub fn fail(mut self, error: PublicSourceControlError) {
        self.emit_terminal(SourceControlOperationEvent::Failed {
            operation_id: self.context.operation_id.clone(),
            repository_id: self.context.repository_id.clone(),
            trunk_id: self.context.trunk_id.clone(),
            error,
        });
    }

    pub fn cancelled(mut self) {
        self.emit_terminal(SourceControlOperationEvent::Cancelled {
            operation_id: self.context.operation_id.clone(),
            repository_id: self.context.repository_id.clone(),
            trunk_id: self.context.trunk_id.clone(),
        });
    }

    fn emit_terminal(&mut self, event: SourceControlOperationEvent) {
        if self.terminal_emitted.get() {
            return;
        }
        self.terminal_emitted.set(true);
        emit_event(self.app.as_ref(), event);
    }
}

impl Drop for SourceControlOperationGuard<'_> {
    fn drop(&mut self) {
        if !self.terminal_emitted.get() {
            let event = if self.context.cancellation.load(Ordering::SeqCst) {
                SourceControlOperationEvent::Cancelled {
                    operation_id: self.context.operation_id.clone(),
                    repository_id: self.context.repository_id.clone(),
                    trunk_id: self.context.trunk_id.clone(),
                }
            } else {
                SourceControlOperationEvent::Failed {
                    operation_id: self.context.operation_id.clone(),
                    repository_id: self.context.repository_id.clone(),
                    trunk_id: self.context.trunk_id.clone(),
                    error: PublicSourceControlError::process_failed("operation", false),
                }
            };
            self.emit_terminal(event);
        }
        self.quit.end_operation();
        if let Some(repository_id) = self.coordinator.finish_operation(&self.context.operation_id) {
            self.coordinator.decrement_pending(&repository_id);
        }
    }
}

fn emit_event(app: Option<&AppHandle>, event: SourceControlOperationEvent) {
    if let Some(app) = app {
        let _ = app.emit("sourceControl://operation", &event);
    }
}

pub fn run_coordinated<T, F>(
    coordinator: &SourceControlOperationCoordinatorState,
    scope: &SourceControlScopeRecord,
    app: Option<&AppHandle>,
    quit: &QuitGuard,
    phase: &'static str,
    run: F,
) -> Result<T, PublicSourceControlError>
where
    F: FnOnce(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    ) -> Result<(T, String), PublicSourceControlError>,
{
    let guard = coordinator.begin(scope, app, quit, phase)?;
    let ctx = guard.context().clone_context();
    match run(&ctx, coordinator) {
        Ok((value, summary)) => {
            guard.complete(summary);
            Ok(value)
        }
        Err(error) => {
            if error.code == PublicSourceControlErrorCode::Cancelled {
                guard.cancelled();
            } else {
                guard.fail(error.clone());
            }
            Err(error)
        }
    }
}

impl SourceControlOperationContext {
    fn clone_context(&self) -> SourceControlOperationContext {
        SourceControlOperationContext {
            operation_id: self.operation_id.clone(),
            repository_id: self.repository_id.clone(),
            trunk_id: self.trunk_id.clone(),
            cancellation: self.cancellation.clone(),
        }
    }
}

pub fn run_coordinated_identity<T, F>(
    coordinator: &SourceControlOperationCoordinatorState,
    repository_id: &str,
    trunk_id: &str,
    app: Option<&AppHandle>,
    quit: &QuitGuard,
    phase: &'static str,
    run: F,
) -> Result<T, PublicSourceControlError>
where
    F: FnOnce(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    ) -> Result<(T, String), PublicSourceControlError>,
{
    let scope = SourceControlScopeRecord {
        scope_id: String::new(),
        project_id: String::new(),
        trunk_id: trunk_id.to_string(),
        project_root: std::path::PathBuf::new(),
        checkout_path: std::path::PathBuf::new(),
        checkout_identity: repository_id.to_string(),
        repository_identity: Some(repository_id.to_string()),
        managed_by_app: false,
    };
    run_coordinated(coordinator, &scope, app, quit, phase, run)
}

#[tauri::command]
pub fn git_operation_cancel(
    input: SourceControlOperationCancelInput,
    coordinator: tauri::State<'_, SourceControlOperationCoordinatorState>,
) -> Result<(), PublicSourceControlError> {
    coordinator.cancel(&input.operation_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source_control::scope_registry::SourceControlScopeRecord;
    use std::path::PathBuf;
    use std::sync::Barrier;
    use std::thread;
    use std::time::Duration;

    fn scope(repository_id: &str, trunk_id: &str) -> SourceControlScopeRecord {
        SourceControlScopeRecord {
            scope_id: "scope-1".into(),
            project_id: "project-1".into(),
            trunk_id: trunk_id.into(),
            project_root: PathBuf::from("/project"),
            checkout_path: PathBuf::from("/project"),
            checkout_identity: format!("checkout:{repository_id}"),
            repository_identity: Some(repository_id.into()),
            managed_by_app: false,
        }
    }

    #[test]
    fn same_repository_mutations_serialize() {
        let coordinator = Arc::new(SourceControlOperationCoordinatorState::default());
        let quit = Arc::new(QuitGuard::default());
        let repo_scope = scope("repo-a", "trunk-a");
        let barrier = Arc::new(Barrier::new(2));
        let started = Arc::new(AtomicBool::new(false));

        let first = coordinator.clone();
        let first_barrier = barrier.clone();
        let first_started = started.clone();
        let first_scope = repo_scope.clone();
        let first_quit = Arc::clone(&quit);
        let first_handle = thread::spawn(move || {
            let guard = first
                .begin(&first_scope, None, &first_quit, "first")
                .expect("begin first");
            first_started.store(true, Ordering::SeqCst);
            thread::sleep(Duration::from_millis(100));
            guard.complete("done");
        });

        while !started.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(5));
        }

        let second = coordinator.clone();
        let second_scope = repo_scope.clone();
        let second_quit = Arc::clone(&quit);
        let second_handle = thread::spawn(move || {
            first_barrier.wait();
            let began = std::time::Instant::now();
            let guard = second
                .begin(&second_scope, None, &second_quit, "second")
                .expect("begin second");
            let elapsed = began.elapsed();
            guard.complete("done");
            elapsed
        });

        barrier.wait();
        let elapsed = second_handle.join().expect("second join");
        first_handle.join().expect("first join");
        assert!(
            elapsed >= Duration::from_millis(50),
            "second operation started before first finished: {:?}",
            elapsed
        );
    }

    #[test]
    fn different_repositories_proceed_independently() {
        let coordinator = Arc::new(SourceControlOperationCoordinatorState::default());
        let quit = Arc::new(QuitGuard::default());
        let barrier = Arc::new(Barrier::new(2));

        let handles = ["repo-a", "repo-b"]
            .into_iter()
            .map(|repo| {
                let coordinator = coordinator.clone();
                let barrier = barrier.clone();
                let thread_quit = Arc::clone(&quit);
                thread::spawn(move || {
                    barrier.wait();
                    let began = std::time::Instant::now();
                    let guard = coordinator
                        .begin(&scope(repo, "trunk"), None, &thread_quit, "parallel")
                        .expect("begin");
                    let elapsed = began.elapsed();
                    guard.complete("done");
                    elapsed
                })
            })
            .collect::<Vec<_>>();

        let elapsed: Vec<_> = handles
            .into_iter()
            .map(|handle| handle.join().expect("join"))
            .collect();
        assert!(
            elapsed.iter().all(|duration| *duration < Duration::from_millis(50)),
            "operations on different repositories blocked each other: {:?}",
            elapsed
        );
    }

    #[test]
    fn cancellation_while_running_sets_flag() {
        let coordinator = SourceControlOperationCoordinatorState::default();
        let quit = QuitGuard::default();
        let guard = coordinator
            .begin(&scope("repo-a", "trunk-a"), None, &quit, "fetch")
            .expect("begin");
        let operation_id = guard.context().operation_id.clone();
        coordinator.cancel(&operation_id).expect("cancel");
        assert!(guard.context().cancellation.load(Ordering::SeqCst));
        guard.cancelled();
    }

    #[test]
    fn unknown_operation_ids_return_not_found() {
        let coordinator = SourceControlOperationCoordinatorState::default();
        let error = coordinator.cancel("missing-op").unwrap_err();
        assert_eq!(error.code, PublicSourceControlErrorCode::NotFound);
    }

    #[test]
    fn guard_drop_restores_quit_guard_and_queue_counts() {
        let coordinator = SourceControlOperationCoordinatorState::default();
        let quit = QuitGuard::default();
        assert_eq!(quit.active_count(), 0);
        assert_eq!(coordinator.pending_count("repo-a"), 0);

        {
            let guard = coordinator
                .begin(&scope("repo-a", "trunk-a"), None, &quit, "stage")
                .expect("begin");
            assert_eq!(quit.active_count(), 1);
            assert_eq!(coordinator.pending_count("repo-a"), 1);
            assert!(coordinator
                .active_operation_ids()
                .contains(&guard.context().operation_id));
            guard.complete("done");
        }

        assert_eq!(quit.active_count(), 0);
        assert_eq!(coordinator.pending_count("repo-a"), 0);
        assert!(coordinator.active_operation_ids().is_empty());
    }
}
