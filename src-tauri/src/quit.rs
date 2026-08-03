use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use crate::terminal::registry::TerminalSessionState;

#[derive(Default)]
pub struct QuitGuard {
    active_operations: Mutex<usize>,
    drain: AtomicBool,
    terminal_state: Mutex<Option<TerminalSessionState>>,
}

#[allow(dead_code)] // QuitGuard is scaffolding for the operation-aware quit lifecycle behind GIT_SUITE_RELEASE_ENABLED.
impl QuitGuard {
    pub fn is_safe_to_quit(&self) -> bool {
        *self.active_operations.lock().unwrap() == 0
    }

    pub fn begin_operation(&self) {
        *self.active_operations.lock().unwrap() += 1;
    }

    pub fn end_operation(&self) {
        let mut count = self.active_operations.lock().unwrap();
        *count = count.saturating_sub(1);
    }

    pub fn active_count(&self) -> usize {
        *self.active_operations.lock().unwrap()
    }

    /// Register the process-wide terminal session registry so that
    /// [`kill_all_terminal_sessions`](Self::kill_all_terminal_sessions) can
    /// tear it down when the app quits. The registry is `Clone` (Arc-backed),
    /// so the guard holds its own handle independent of Tauri-managed state.
    pub fn register_terminal_state(&self, state: TerminalSessionState) {
        *self.terminal_state.lock().unwrap() = Some(state);
    }

    /// Kill every live terminal session and join its reader threads. Called
    /// from the app's exit path; safe to call multiple times (idempotent via
    /// the registry's `kill_all` draining its map).
    pub fn kill_all_terminal_sessions(&self) {
        if let Some(state) = self.terminal_state.lock().unwrap().as_ref() {
            state.kill_all();
        }
    }

    pub fn request_drain(&self) {
        self.drain.store(true, Ordering::SeqCst);
    }

    pub fn is_draining(&self) -> bool {
        self.drain.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracks_active_operations() {
        let guard = QuitGuard::default();
        assert!(guard.is_safe_to_quit());
        guard.begin_operation();
        assert!(!guard.is_safe_to_quit());
        assert_eq!(guard.active_count(), 1);
        guard.end_operation();
        assert!(guard.is_safe_to_quit());
    }

    #[test]
    fn drain_signals_graceful_shutdown() {
        let guard = QuitGuard::default();
        guard.begin_operation();
        guard.request_drain();
        assert!(guard.is_draining());
        guard.end_operation();
        assert!(guard.is_safe_to_quit());
    }

    #[test]
    fn kill_all_terminal_sessions_is_safe_without_registration() {
        let guard = QuitGuard::default();
        // No panic when no terminal state was registered.
        guard.kill_all_terminal_sessions();
    }

    #[test]
    fn registered_terminal_state_is_cleaned_up() {
        use crate::terminal::registry::TerminalSessionState;
        let guard = QuitGuard::default();
        guard.register_terminal_state(TerminalSessionState::default());
        // Must not panic: an empty registry has nothing to kill, and the
        // registry drains its session map during cleanup.
        guard.kill_all_terminal_sessions();
    }
}
