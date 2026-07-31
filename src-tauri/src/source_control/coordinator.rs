use crate::source_control::contracts::PublicSourceControlError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

// Scaffolding for the operation-coordinator track; not yet wired into lib.rs.
#[allow(dead_code)]
/// Per-repository operation state for serialization and revision tracking.
#[derive(Default)]
pub struct SourceControlCoordinatorState {
    queues: Mutex<HashMap<String, CoordinatorEntry>>,
}

// Scaffolding for the operation-coordinator track; not yet wired into lib.rs.
#[allow(dead_code)]
#[derive(Debug, Clone)]
struct CoordinatorEntry {
    revision: u64,
    operations_pending: usize,
}

// Scaffolding for the operation-coordinator track; not yet wired into lib.rs.
#[allow(dead_code)]
impl SourceControlCoordinatorState {
    pub fn next_revision(&self, repository_identity: &str) -> u64 {
        let mut queues = self.queues.lock().unwrap();
        let entry = queues
            .entry(repository_identity.to_string())
            .or_insert_with(|| CoordinatorEntry {
                revision: 0,
                operations_pending: 0,
            });
        entry.revision += 1;
        entry.revision
    }

    pub fn begin_operation(&self, repository_identity: &str) -> u64 {
        let mut queues = self.queues.lock().unwrap();
        let entry = queues
            .entry(repository_identity.to_string())
            .or_insert_with(|| CoordinatorEntry {
                revision: 0,
                operations_pending: 0,
            });
        entry.operations_pending += 1;
        entry.revision += 1;
        entry.revision
    }

    pub fn end_operation(&self, repository_identity: &str) {
        let mut queues = self.queues.lock().unwrap();
        if let Some(entry) = queues.get_mut(repository_identity) {
            entry.operations_pending = entry.operations_pending.saturating_sub(1);
        }
    }
}

// Scaffolding for the operation-coordinator track; not yet wired into lib.rs.
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlOperationProgress {
    pub operation_id: String,
    pub repository_id: String,
    pub phase: String,
    pub message: String,
    pub cancellable: bool,
    pub completed: Option<u64>,
    pub total: Option<u64>,
}

// Scaffolding for the operation-coordinator track; not yet wired into lib.rs.
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlOperationCancellation {
    pub operation_id: String,
}

// Scaffolding for the operation-coordinator track; not yet wired into lib.rs.
#[allow(dead_code)]
/// Cancel a pending operation. The coordinator itself does not
/// perform the cancellation — it records the intent and the actual
/// process runner checks the flag before each poll cycle.
pub fn cancel_operation(
    _state: &SourceControlCoordinatorState,
    _input: SourceControlOperationCancellation,
) -> Result<(), PublicSourceControlError> {
    // Stub: operation cancellation is wired through the process layer.
    // The coordinator tracks the cancellation intent; the process runner
    // checks before each poll cycle.
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn revision_increments_per_repository() {
        let state = SourceControlCoordinatorState::default();
        let r1 = state.next_revision("repo-a");
        let r2 = state.next_revision("repo-a");
        let r3 = state.next_revision("repo-b");
        assert_eq!(r1, 1);
        assert_eq!(r2, 2);
        assert_eq!(r3, 1);
    }

    #[test]
    fn begin_end_operations_track_count() {
        let state = SourceControlCoordinatorState::default();
        state.begin_operation("repo-a");
        state.begin_operation("repo-a");
        assert_eq!(
            state
                .queues
                .lock()
                .unwrap()
                .get("repo-a")
                .unwrap()
                .operations_pending,
            2
        );
        state.end_operation("repo-a");
        assert_eq!(
            state
                .queues
                .lock()
                .unwrap()
                .get("repo-a")
                .unwrap()
                .operations_pending,
            1
        );
        state.end_operation("repo-a");
        assert_eq!(
            state
                .queues
                .lock()
                .unwrap()
                .get("repo-a")
                .unwrap()
                .operations_pending,
            0
        );
    }

    #[test]
    fn cancel_operation_succeeds_for_unknown_id() {
        let state = SourceControlCoordinatorState::default();
        cancel_operation(
            &state,
            SourceControlOperationCancellation {
                operation_id: "nonexistent".into(),
            },
        )
        .unwrap();
    }
}
