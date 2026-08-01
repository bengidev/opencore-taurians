use crate::path_scope::normalize_path;
use crate::source_control::scope_registry::SourceControlScopeRegistry;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const DEBOUNCE_MS: u64 = 300;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WatchChangeKind {
    Added,
    Modified,
    Removed,
    Coalesced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchChangeEvent {
    pub root: String,
    pub revision: u64,
    pub kinds: Vec<WatchChangeKind>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchSubscribeInput {
    pub scope_id: String,
    pub mode: String,
    pub identity: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchUnsubscribeInput {
    pub scope_id: String,
    pub identity: String,
}

struct WatchHandle {
    _watcher: RecommendedWatcher,
    _debounce_tx: mpsc::Sender<()>,
    subscribers: HashSet<String>,
}

pub struct WatchBroker {
    handles: Mutex<HashMap<String, WatchHandle>>,
}

impl Default for WatchBroker {
    fn default() -> Self {
        Self {
            handles: Mutex::new(HashMap::new()),
        }
    }
}

impl WatchBroker {
    fn resolve_root(
        registry: &SourceControlScopeRegistry,
        scope_id: &str,
        operation: &'static str,
    ) -> Result<String, String> {
        let record = registry
            .resolve(scope_id, operation)
            .map_err(|error| error.message)?;
        Ok(normalize_path(&record.checkout_path)
            .to_string_lossy()
            .into_owned())
    }

    pub fn subscribe(
        &self,
        input: WatchSubscribeInput,
        registry: &SourceControlScopeRegistry,
        app: Option<&AppHandle>,
    ) -> Result<(), String> {
        if input.mode != "live" {
            return self.unsubscribe(
                WatchUnsubscribeInput {
                    scope_id: input.scope_id,
                    identity: input.identity,
                },
                registry,
            );
        }

        let root = Self::resolve_root(registry, &input.scope_id, "watch_subscribe")?;
        let mut guard = self.handles.lock().map_err(|error| error.to_string())?;

        if let Some(handle) = guard.get_mut(&root) {
            handle.subscribers.insert(input.identity);
            return Ok(());
        }

        let (debounce_tx, debounce_rx) = mpsc::channel();
        let app_handle = app.cloned();
        let root_clone = root.clone();

        std::thread::spawn(move || {
            let mut revision: u64 = 0;
            loop {
                match debounce_rx.recv() {
                    Ok(()) => loop {
                        match debounce_rx.recv_timeout(Duration::from_millis(DEBOUNCE_MS)) {
                            Ok(()) => {}
                            Err(RecvTimeoutError::Timeout) => {
                                if let Some(app) = app_handle.as_ref() {
                                    revision += 1;
                                    let _ = app.emit(
                                        "watch://changed",
                                        WatchChangeEvent {
                                            root: root_clone.clone(),
                                            revision,
                                            kinds: vec![WatchChangeKind::Coalesced],
                                        },
                                    );
                                }
                                break;
                            }
                            Err(RecvTimeoutError::Disconnected) => return,
                        }
                    },
                    Err(_) => return,
                }
            }
        });

        let debounce_tx2 = debounce_tx.clone();
        let mut watcher = RecommendedWatcher::new(
            move |_res| {
                let _ = debounce_tx2.send(());
            },
            Config::default(),
        )
        .map_err(|error| error.to_string())?;

        watcher
            .watch(Path::new(&root), RecursiveMode::Recursive)
            .map_err(|error| error.to_string())?;

        let mut subscribers = HashSet::new();
        subscribers.insert(input.identity);

        guard.insert(
            root,
            WatchHandle {
                _watcher: watcher,
                _debounce_tx: debounce_tx,
                subscribers,
            },
        );

        Ok(())
    }

    pub fn unsubscribe(
        &self,
        input: WatchUnsubscribeInput,
        registry: &SourceControlScopeRegistry,
    ) -> Result<(), String> {
        let root = Self::resolve_root(registry, &input.scope_id, "watch_unsubscribe")?;
        let mut guard = self.handles.lock().map_err(|error| error.to_string())?;
        let Some(handle) = guard.get_mut(&root) else {
            return Ok(());
        };

        handle.subscribers.remove(&input.identity);
        if handle.subscribers.is_empty() {
            guard.remove(&root);
        }

        Ok(())
    }

    #[cfg(test)]
    fn test_snapshot(&self) -> HashMap<String, usize> {
        self.handles
            .lock()
            .unwrap()
            .iter()
            .map(|(root, handle)| (root.clone(), handle.subscribers.len()))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source_control::scope_registry::SourceControlScopeRecord;
    use std::fs;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn register_scope(registry: &SourceControlScopeRegistry, checkout_path: PathBuf) -> String {
        registry.register(SourceControlScopeRecord {
            scope_id: String::new(),
            project_id: "project-1".into(),
            trunk_id: "trunk-1".into(),
            project_root: checkout_path.clone(),
            checkout_path,
            checkout_identity: "checkout:test".into(),
            repository_identity: None,
            managed_by_app: false,
        })
    }

    fn subscribe_live(
        broker: &WatchBroker,
        registry: &SourceControlScopeRegistry,
        scope_id: &str,
        identity: &str,
    ) {
        broker
            .subscribe(
                WatchSubscribeInput {
                    scope_id: scope_id.into(),
                    mode: "live".into(),
                    identity: identity.into(),
                },
                registry,
                None,
            )
            .unwrap();
    }

    fn unsubscribe(
        broker: &WatchBroker,
        registry: &SourceControlScopeRegistry,
        scope_id: &str,
        identity: &str,
    ) {
        broker
            .unsubscribe(
                WatchUnsubscribeInput {
                    scope_id: scope_id.into(),
                    identity: identity.into(),
                },
                registry,
            )
            .unwrap();
    }

    #[test]
    fn duplicate_subscribe_for_same_identity_is_idempotent() {
        let dir = tempdir().unwrap();
        let registry = SourceControlScopeRegistry::default();
        let scope_id = register_scope(&registry, dir.path().to_path_buf());
        let broker = WatchBroker::default();

        subscribe_live(&broker, &registry, &scope_id, "explorer");
        subscribe_live(&broker, &registry, &scope_id, "explorer");

        let snapshot = broker.test_snapshot();
        assert_eq!(snapshot.len(), 1);
        assert_eq!(snapshot.values().next().copied(), Some(1));
    }

    #[test]
    fn two_subscribers_share_one_handle() {
        let dir = tempdir().unwrap();
        let registry = SourceControlScopeRegistry::default();
        let scope_id = register_scope(&registry, dir.path().to_path_buf());
        let broker = WatchBroker::default();

        subscribe_live(&broker, &registry, &scope_id, "explorer");
        subscribe_live(
            &broker,
            &registry,
            &scope_id,
            &format!("source-control:{scope_id}"),
        );

        let snapshot = broker.test_snapshot();
        assert_eq!(snapshot.len(), 1);
        assert_eq!(snapshot.values().next().copied(), Some(2));
    }

    #[test]
    fn one_unsubscribe_preserves_handle_for_remaining_subscriber() {
        let dir = tempdir().unwrap();
        let registry = SourceControlScopeRegistry::default();
        let scope_id = register_scope(&registry, dir.path().to_path_buf());
        let broker = WatchBroker::default();

        subscribe_live(&broker, &registry, &scope_id, "explorer");
        subscribe_live(
            &broker,
            &registry,
            &scope_id,
            &format!("source-control:{scope_id}"),
        );
        unsubscribe(&broker, &registry, &scope_id, "explorer");

        let snapshot = broker.test_snapshot();
        assert_eq!(snapshot.len(), 1);
        assert_eq!(snapshot.values().next().copied(), Some(1));
    }

    #[test]
    fn final_unsubscribe_removes_handle() {
        let dir = tempdir().unwrap();
        let registry = SourceControlScopeRegistry::default();
        let scope_id = register_scope(&registry, dir.path().to_path_buf());
        let broker = WatchBroker::default();

        subscribe_live(&broker, &registry, &scope_id, "explorer");
        unsubscribe(&broker, &registry, &scope_id, "explorer");

        assert!(broker.test_snapshot().is_empty());
    }

    #[test]
    fn canonicalizes_checkout_root_for_handle_key() {
        let dir = tempdir().unwrap();
        let child = dir.path().join("nested");
        fs::create_dir(&child).unwrap();

        let registry = SourceControlScopeRegistry::default();
        let scope_a = register_scope(&registry, child.clone());
        let scope_b = register_scope(&registry, dir.path().join("nested/."));
        let broker = WatchBroker::default();

        subscribe_live(&broker, &registry, &scope_a, "explorer");
        subscribe_live(&broker, &registry, &scope_b, "source-control:other");

        let snapshot = broker.test_snapshot();
        assert_eq!(snapshot.len(), 1);
        assert_eq!(snapshot.values().next().copied(), Some(2));
    }

    #[test]
    fn subscribe_with_non_live_mode_is_noop_without_live_handle() {
        let broker = WatchBroker::default();
        let registry = SourceControlScopeRegistry::default();
        let scope_id = register_scope(&registry, PathBuf::from("/tmp/test"));

        broker
            .subscribe(
                WatchSubscribeInput {
                    scope_id,
                    mode: "on-activate".into(),
                    identity: "explorer".into(),
                },
                &registry,
                None,
            )
            .unwrap();

        assert!(broker.test_snapshot().is_empty());
    }

    #[test]
    fn unsubscribe_empty_is_noop() {
        let broker = WatchBroker::default();
        let registry = SourceControlScopeRegistry::default();
        let scope_id = register_scope(&registry, PathBuf::from("/nonexistent"));

        unsubscribe(&broker, &registry, &scope_id, "explorer");
    }
}
