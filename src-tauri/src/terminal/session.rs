use parking_lot::Mutex;
use portable_pty::{ChildKiller, MasterPty};
use std::sync::Arc;
use std::thread::JoinHandle;

/// A live terminal session. Inner pieces are wrapped in `Arc<Mutex<...>>` so the
/// registry can vend cheap cloned handles while the PTY state stays shared.
///
/// v1 placeholder: holds the pieces spawned by a later task (`TerminalSession::spawn`).
#[derive(Clone)]
pub struct TerminalSession {
    pub session_id: String,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send + Sync>>>,
    pub writer: Arc<Mutex<Box<dyn std::io::Write + Send + Sync>>>,
    pub killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
    pub reader_thread: Arc<Mutex<Option<JoinHandle<()>>>>,
}
