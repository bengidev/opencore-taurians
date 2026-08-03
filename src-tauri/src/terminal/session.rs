use std::io::Read;
use std::sync::Arc;
use std::thread::{self, JoinHandle};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use parking_lot::Mutex;
use portable_pty::{ChildKiller, CommandBuilder, MasterPty, PtySize};
use uuid::Uuid;

use super::error::PublicTerminalError;
use super::types::{
    TerminalChannel, TerminalChannelMessageKind, TerminalExitEvent, TerminalOutputChunk,
    TerminalSessionInfo, TerminalSpawnInput,
};

/// A live terminal session. Inner pieces are wrapped in `Arc<Mutex<...>>` so the
/// registry can vend cheap cloned handles while the PTY state stays shared.
///
/// The `master`/`writer` boxes are `Send` (not `Sync`): portable-pty's unix
/// `MasterPty` impl uses interior mutability (`RefCell`), so the trait objects
/// cannot carry a `Sync` bound. Access is already serialized by the `Mutex`.
#[derive(Clone)]
pub struct TerminalSession {
    pub session_id: String,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    pub writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
    pub killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
    pub reader_thread: Arc<Mutex<Option<JoinHandle<()>>>>,
}

/// Manual `Debug`: the inner trait objects (`MasterPty`, `Write`, `ChildKiller`)
/// are not `Debug`, so the derive would fail. Only the id is meaningful to log.
impl std::fmt::Debug for TerminalSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TerminalSession")
            .field("session_id", &self.session_id)
            .finish_non_exhaustive()
    }
}

impl TerminalSession {
    /// Spawn the system default shell in `input.cwd` inside a fresh PTY and
    /// start a dedicated reader thread that streams output to `channel`.
    ///
    /// The reader thread runs on a plain `std::thread` (never a tokio task):
    /// blocking PTY reads must not occupy the async runtime.
    pub fn spawn(
        input: TerminalSpawnInput,
        channel: TerminalChannel,
    ) -> Result<(Self, TerminalSessionInfo), PublicTerminalError> {
        let cwd = std::path::PathBuf::from(&input.cwd);
        if !cwd.is_dir() {
            return Err(PublicTerminalError::InvalidWorkingDirectory {
                path: input.cwd.clone(),
            });
        }

        let shell = resolve_default_shell();
        if shell.is_empty() {
            return Err(PublicTerminalError::ShellNotFound);
        }

        let pty_system = portable_pty::native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: input.rows,
                cols: input.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| PublicTerminalError::SpawnFailed {
                message: e.to_string(),
            })?;

        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(cwd);

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| PublicTerminalError::SpawnFailed {
                message: e.to_string(),
            })?;

        let killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>> =
            Arc::new(Mutex::new(child.clone_killer()));

        let reader = pair.master.try_clone_reader().map_err(|e| {
            PublicTerminalError::SpawnFailed {
                message: e.to_string(),
            }
        })?;

        let writer = pair.master.take_writer().map_err(|e| {
            PublicTerminalError::SpawnFailed {
                message: e.to_string(),
            }
        })?;

        let master: Box<dyn MasterPty + Send> = pair.master;

        let session_id = Uuid::new_v4().to_string();
        let session_id_for_thread = session_id.clone();

        let reader_thread = thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = STANDARD.encode(&buf[..n]);
                        let _ = channel.send(TerminalChannelMessageKind::Output(
                            TerminalOutputChunk { data },
                        ));
                    }
                    Err(_e) => break,
                }
            }

            let (exit_code, signal) = child
                .wait()
                .ok()
                .map(|status| {
                    let signal = status.signal().map(|s| s.to_string());
                    (Some(status.exit_code() as i32), signal)
                })
                .unwrap_or((None, None));
            let _ = channel.send(TerminalChannelMessageKind::Exit(TerminalExitEvent {
                session_id: session_id_for_thread,
                exit_code,
                signal,
            }));
        });

        let info = TerminalSessionInfo {
            session_id: session_id.clone(),
            shell: shell.clone(),
            cwd: input.cwd.clone(),
            cols: input.cols,
            rows: input.rows,
        };

        let session = TerminalSession {
            session_id,
            master: Arc::new(Mutex::new(master)),
            writer: Arc::new(Mutex::new(writer)),
            killer,
            reader_thread: Arc::new(Mutex::new(Some(reader_thread))),
        };

        Ok((session, info))
    }
}

#[cfg(target_os = "windows")]
fn resolve_default_shell() -> String {
    std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_string())
}

#[cfg(not(target_os = "windows"))]
fn resolve_default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}
