use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

#[derive(Default)]
pub struct QuitGuard {
    active_operations: Mutex<usize>,
    drain: AtomicBool,
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
}
