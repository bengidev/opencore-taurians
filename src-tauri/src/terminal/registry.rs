use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;

use super::session::TerminalSession;

/// Process-wide registry of live terminal sessions, safe for concurrent access
/// from Tauri commands. Held as managed state and shared via `Arc`.
#[derive(Debug, Clone)]
pub struct TerminalSessionState {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl Default for TerminalSessionState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl TerminalSessionState {
    /// Insert a session, keyed by its `session_id`.
    pub fn insert(&self, session: TerminalSession) {
        let mut sessions = self.sessions.lock();
        sessions.insert(session.session_id.clone(), session);
    }

    /// Return a cloned handle for the session with the given id, if present.
    pub fn get(&self, session_id: &str) -> Option<TerminalSession> {
        let sessions = self.sessions.lock();
        sessions.get(session_id).cloned()
    }

    /// Remove and return the session with the given id, if present.
    pub fn remove(&self, session_id: &str) -> Option<TerminalSession> {
        let mut sessions = self.sessions.lock();
        sessions.remove(session_id)
    }

    /// Kill every live session and join its reader thread. Used on app shutdown.
    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock();
        for (_id, mut session) in sessions.drain() {
            if let Ok(mut killer) = session.killer.lock() {
                let _ = killer.kill();
            }
            if let Some(handle) = session.reader_thread.lock().take() {
                let _ = handle.join();
            }
        }
    }
}
