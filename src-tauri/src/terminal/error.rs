use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "error", rename_all_fields = "camelCase")]
pub enum PublicTerminalError {
    ShellNotFound,
    InvalidWorkingDirectory { path: String },
    SpawnFailed { message: String },
    SessionNotFound { session_id: String },
    WriteFailed { message: String },
    ResizeFailed { message: String },
}

impl std::fmt::Display for PublicTerminalError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PublicTerminalError::ShellNotFound => write!(f, "Default shell not found"),
            PublicTerminalError::InvalidWorkingDirectory { path } => {
                write!(f, "Invalid working directory: {}", path)
            }
            PublicTerminalError::SpawnFailed { message } => write!(f, "Spawn failed: {}", message),
            PublicTerminalError::SessionNotFound { session_id } => {
                write!(f, "Terminal session not found: {}", session_id)
            }
            PublicTerminalError::WriteFailed { message } => write!(f, "Write failed: {}", message),
            PublicTerminalError::ResizeFailed { message } => {
                write!(f, "Resize failed: {}", message)
            }
        }
    }
}

impl std::error::Error for PublicTerminalError {}

#[derive(Debug, Error)]
// This enum bridges portable_pty errors to the webview. It is only
// constructed in session.rs (via `.map_err(Into::into)?`) where the
// conversion path assigns to `Result<_, PublicTerminalError>`, so
// clippy sees no direct variable read and flags it dead. Suppress.
#[allow(dead_code)]
pub enum InternalTerminalError {
    #[error("PTY system unavailable: {0}")]
    PtySystemUnavailable(String),
    #[error("Failed to spawn PTY: {0}")]
    SpawnFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}
