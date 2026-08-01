use crate::source_control::contracts::PublicSourceControlError;
use std::ffi::OsString;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

const DEFAULT_OUTPUT_LIMIT: usize = 256 * 1024;
const POLL_INTERVAL: Duration = Duration::from_millis(10);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceControlExecutionPolicy {
    ParsedRead,
    BackgroundNetwork,
    TrustedMutation,
}

#[derive(Debug, Clone)]
pub struct SourceControlCommandSpec {
    pub checkout: PathBuf,
    pub operation: &'static str,
    pub args: Vec<OsString>,
    pub timeout: Duration,
    pub stdout_limit: usize,
    pub stderr_limit: usize,
    pub policy: SourceControlExecutionPolicy,
    pub cancellation: Option<Arc<AtomicBool>>,
    pub child_slot: Option<Arc<Mutex<Option<std::process::Child>>>>,
}

impl SourceControlCommandSpec {
    pub fn parsed_read(
        checkout: impl Into<PathBuf>,
        operation: &'static str,
        args: impl IntoIterator<Item = impl Into<OsString>>,
    ) -> Self {
        Self {
            checkout: checkout.into(),
            operation,
            args: args.into_iter().map(Into::into).collect(),
            timeout: Duration::from_secs(30),
            stdout_limit: DEFAULT_OUTPUT_LIMIT,
            stderr_limit: DEFAULT_OUTPUT_LIMIT,
            policy: SourceControlExecutionPolicy::ParsedRead,
            cancellation: None,
            child_slot: None,
        }
    }

    pub fn trusted_mutation(
        checkout: impl Into<PathBuf>,
        args: impl IntoIterator<Item = impl Into<OsString>>,
    ) -> Self {
        Self {
            checkout: checkout.into(),
            operation: "mutation",
            args: args.into_iter().map(Into::into).collect(),
            timeout: Duration::from_secs(60),
            stdout_limit: DEFAULT_OUTPUT_LIMIT,
            stderr_limit: DEFAULT_OUTPUT_LIMIT,
            policy: SourceControlExecutionPolicy::TrustedMutation,
            cancellation: None,
            child_slot: None,
        }
    }

    pub fn attach_operation(
        mut self,
        cancellation: Arc<AtomicBool>,
        child_slot: Arc<Mutex<Option<std::process::Child>>>,
    ) -> Self {
        self.cancellation = Some(cancellation);
        self.child_slot = Some(child_slot);
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceControlProcessOutput {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

pub trait SourceControlProcess: Send + Sync {
    fn run(
        &self,
        spec: SourceControlCommandSpec,
    ) -> Result<SourceControlProcessOutput, PublicSourceControlError>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemGitProcess;

impl SystemGitProcess {
    #[allow(dead_code)]
    pub fn discover(&self) -> Result<String, PublicSourceControlError> {
        let output = Command::new("git")
            .arg("--version")
            .env("LC_ALL", "C")
            .env("LANG", "C")
            .stdin(Stdio::null())
            .output()
            .map_err(|_| PublicSourceControlError::git_unavailable("discover"))?;
        if !output.status.success() {
            return Err(PublicSourceControlError::git_unavailable("discover"));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    fn command(spec: &SourceControlCommandSpec) -> Command {
        let mut command = Command::new("git");
        command
            .arg("-C")
            .arg(&spec.checkout)
            .env("LC_ALL", "C")
            .env("LANG", "C")
            .env("GIT_PAGER", "cat")
            .env("PAGER", "cat")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match spec.policy {
            SourceControlExecutionPolicy::ParsedRead => {
                command.arg("-c").arg("core.pager=cat");
            }
            SourceControlExecutionPolicy::BackgroundNetwork => {
                command
                    .env("GIT_TERMINAL_PROMPT", "0")
                    .env("GCM_INTERACTIVE", "Never");
            }
            SourceControlExecutionPolicy::TrustedMutation => {}
        }
        command.args(&spec.args);
        command
    }
}

impl SourceControlProcess for SystemGitProcess {
    fn run(
        &self,
        spec: SourceControlCommandSpec,
    ) -> Result<SourceControlProcessOutput, PublicSourceControlError> {
        let child_slot = spec
            .child_slot
            .clone()
            .unwrap_or_else(|| Arc::new(Mutex::new(None)));
        let mut child = Self::command(&spec)
            .spawn()
            .map_err(|_| PublicSourceControlError::git_unavailable(spec.operation))?;
        let stdout = child.stdout.take().expect("stdout is piped");
        let stderr = child.stderr.take().expect("stderr is piped");
        *child_slot.lock().unwrap() = Some(child);

        let (sender, receiver) = mpsc::channel();

        spawn_bounded_reader(
            stdout,
            spec.stdout_limit,
            StreamKind::Stdout,
            sender.clone(),
        );
        spawn_bounded_reader(stderr, spec.stderr_limit, StreamKind::Stderr, sender);

        let started = Instant::now();
        let status = loop {
            if spec
                .cancellation
                .as_ref()
                .is_some_and(|flag| flag.load(Ordering::SeqCst))
            {
                kill_child(&child_slot);
                return Err(PublicSourceControlError::cancelled(spec.operation));
            }
            if started.elapsed() > spec.timeout {
                kill_child(&child_slot);
                return Err(PublicSourceControlError::timeout(spec.operation));
            }
            let mut guard = child_slot.lock().unwrap();
            let Some(ref mut child) = *guard else {
                return Err(PublicSourceControlError::process_failed(
                    spec.operation,
                    true,
                ));
            };
            match child.try_wait() {
                Ok(Some(status)) => {
                    *guard = None;
                    break status;
                }
                Ok(None) => {
                    drop(guard);
                    thread::sleep(POLL_INTERVAL);
                }
                Err(_) => {
                    return Err(PublicSourceControlError::process_failed(
                        spec.operation,
                        true,
                    ))
                }
            }
        };

        let mut stdout = None;
        let mut stderr = None;
        for _ in 0..2 {
            let stream = receiver
                .recv_timeout(Duration::from_secs(1))
                .map_err(|_| PublicSourceControlError::process_failed(spec.operation, true))?;
            match stream {
                StreamResult::Data(StreamKind::Stdout, data) => stdout = Some(data),
                StreamResult::Data(StreamKind::Stderr, data) => stderr = Some(data),
                StreamResult::LimitExceeded => {
                    return Err(PublicSourceControlError::output_limit(spec.operation));
                }
                StreamResult::ReadFailed => {
                    return Err(PublicSourceControlError::process_failed(
                        spec.operation,
                        true,
                    ));
                }
            }
        }

        let output = SourceControlProcessOutput {
            status,
            stdout: stdout.unwrap_or_default(),
            stderr: stderr.unwrap_or_default(),
        };
        if output.status.success() {
            return Ok(output);
        }
        if stderr_looks_like_authentication(&output.stderr) {
            return Err(PublicSourceControlError::authentication_required(
                spec.operation,
            ));
        }
        Err(PublicSourceControlError::process_failed(
            spec.operation,
            false,
        ))
    }
}

fn kill_child(child_slot: &Arc<Mutex<Option<std::process::Child>>>) {
    if let Ok(mut guard) = child_slot.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[derive(Debug, Clone, Copy)]
enum StreamKind {
    Stdout,
    Stderr,
}

enum StreamResult {
    Data(StreamKind, Vec<u8>),
    LimitExceeded,
    ReadFailed,
}

fn spawn_bounded_reader(
    reader: impl Read + Send + 'static,
    limit: usize,
    kind: StreamKind,
    sender: mpsc::Sender<StreamResult>,
) {
    thread::spawn(move || {
        let message = match read_bounded(reader, limit) {
            Ok(data) => StreamResult::Data(kind, data),
            Err(BoundedReadError::LimitExceeded) => StreamResult::LimitExceeded,
            Err(BoundedReadError::Io) => StreamResult::ReadFailed,
        };
        let _ = sender.send(message);
    });
}

#[derive(Debug, PartialEq, Eq)]
enum BoundedReadError {
    LimitExceeded,
    Io,
}

fn read_bounded(mut reader: impl Read, limit: usize) -> Result<Vec<u8>, BoundedReadError> {
    let mut output = Vec::new();
    let mut chunk = [0_u8; 8192];
    loop {
        let read = reader.read(&mut chunk).map_err(|_| BoundedReadError::Io)?;
        if read == 0 {
            return Ok(output);
        }
        if output.len().saturating_add(read) > limit {
            return Err(BoundedReadError::LimitExceeded);
        }
        output.extend_from_slice(&chunk[..read]);
    }
}

fn stderr_looks_like_authentication(stderr: &[u8]) -> bool {
    let message = String::from_utf8_lossy(stderr).to_ascii_lowercase();
    [
        "authentication failed",
        "could not read username",
        "permission denied (publickey)",
        "terminal prompts disabled",
    ]
    .iter()
    .any(|needle| message.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source_control::contracts::PublicSourceControlErrorCode;
    use std::fs;
    use std::io;
    use tempfile::tempdir;

    fn init_repository() -> tempfile::TempDir {
        let dir = tempdir().unwrap();
        let output = Command::new("git")
            .args(["init", "--quiet"])
            .arg(dir.path())
            .output()
            .unwrap();
        assert!(output.status.success());
        dir
    }

    #[test]
    fn discovers_system_git() {
        let version = SystemGitProcess.discover().unwrap();
        assert!(version.starts_with("git version "));
    }

    #[test]
    fn passes_checkout_and_arguments_without_shell_interpolation() {
        let root = tempdir().unwrap();
        let checkout = root.path().join("repo with spaces ü");
        fs::create_dir(&checkout).unwrap();
        let output = Command::new("git")
            .args(["init", "--quiet"])
            .arg(&checkout)
            .output()
            .unwrap();
        assert!(output.status.success());

        let output = SystemGitProcess
            .run(SourceControlCommandSpec::parsed_read(
                &checkout,
                "rev-parse",
                ["rev-parse", "--show-toplevel"],
            ))
            .unwrap();
        assert_eq!(
            String::from_utf8_lossy(&output.stdout).trim(),
            fs::canonicalize(&checkout).unwrap().to_string_lossy()
        );
    }

    #[test]
    fn enforces_output_limit() {
        let repository = init_repository();
        let mut spec = SourceControlCommandSpec::parsed_read(
            repository.path(),
            "config-list",
            ["config", "--list", "--show-origin"],
        );
        spec.stdout_limit = 1;
        let error = SystemGitProcess.run(spec).unwrap_err();
        assert_eq!(error.code, PublicSourceControlErrorCode::OutputLimit);
        assert!(!error
            .message
            .contains(repository.path().to_string_lossy().as_ref()));
    }

    #[test]
    fn bounded_reader_rejects_extra_bytes() {
        let error = read_bounded(io::Cursor::new(b"secret"), 3).unwrap_err();
        assert_eq!(error, BoundedReadError::LimitExceeded);
    }

    #[test]
    fn classifies_common_authentication_errors_without_returning_stderr() {
        assert!(stderr_looks_like_authentication(
            b"fatal: could not read Username for 'https://example.com': terminal prompts disabled"
        ));
        let error = PublicSourceControlError::authentication_required("fetch");
        assert_eq!(
            error.code,
            PublicSourceControlErrorCode::AuthenticationRequired
        );
        assert!(!error.message.contains("example.com"));
    }

    #[derive(Debug, Default, Clone, Copy)]
    struct BlockingSleepProcess;

    impl SourceControlProcess for BlockingSleepProcess {
        fn run(
            &self,
            spec: SourceControlCommandSpec,
        ) -> Result<SourceControlProcessOutput, PublicSourceControlError> {
            let child_slot = spec
                .child_slot
                .clone()
                .unwrap_or_else(|| Arc::new(Mutex::new(None)));
            let mut child = Command::new("sleep")
                .arg("30")
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|_| PublicSourceControlError::git_unavailable(spec.operation))?;
            let stdout = child.stdout.take().expect("stdout is piped");
            let stderr = child.stderr.take().expect("stderr is piped");
            *child_slot.lock().unwrap() = Some(child);

            let (sender, receiver) = mpsc::channel();
            spawn_bounded_reader(
                stdout,
                spec.stdout_limit,
                StreamKind::Stdout,
                sender.clone(),
            );
            spawn_bounded_reader(stderr, spec.stderr_limit, StreamKind::Stderr, sender);

            let started = Instant::now();
            let status = loop {
                if spec
                    .cancellation
                    .as_ref()
                    .is_some_and(|flag| flag.load(Ordering::SeqCst))
                {
                    kill_child(&child_slot);
                    return Err(PublicSourceControlError::cancelled(spec.operation));
                }
                if started.elapsed() > spec.timeout {
                    kill_child(&child_slot);
                    return Err(PublicSourceControlError::timeout(spec.operation));
                }
                let mut guard = child_slot.lock().unwrap();
                let Some(ref mut child) = *guard else {
                    return Err(PublicSourceControlError::process_failed(
                        spec.operation,
                        true,
                    ));
                };
                match child.try_wait() {
                    Ok(Some(status)) => {
                        *guard = None;
                        break status;
                    }
                    Ok(None) => {
                        drop(guard);
                        thread::sleep(POLL_INTERVAL);
                    }
                    Err(_) => {
                        return Err(PublicSourceControlError::process_failed(
                            spec.operation,
                            true,
                        ))
                    }
                }
            };

            for _ in 0..2 {
                let _ = receiver.recv_timeout(Duration::from_secs(1));
            }
            Ok(SourceControlProcessOutput {
                status,
                stdout: Vec::new(),
                stderr: Vec::new(),
            })
        }
    }

    #[test]
    fn cancellation_kills_long_running_child() {
        let cancellation = Arc::new(AtomicBool::new(false));
        let child_slot = Arc::new(Mutex::new(None));
        let cancel_flag = cancellation.clone();
        let handle = thread::spawn(move || {
            thread::sleep(Duration::from_millis(50));
            cancel_flag.store(true, Ordering::SeqCst);
        });

        let spec = SourceControlCommandSpec {
            checkout: PathBuf::from("."),
            operation: "sleep",
            args: vec![OsString::from("30")],
            timeout: Duration::from_secs(60),
            stdout_limit: DEFAULT_OUTPUT_LIMIT,
            stderr_limit: DEFAULT_OUTPUT_LIMIT,
            policy: SourceControlExecutionPolicy::TrustedMutation,
            cancellation: Some(cancellation),
            child_slot: Some(child_slot.clone()),
        };

        let error = BlockingSleepProcess.run(spec).unwrap_err();
        handle.join().unwrap();
        assert_eq!(error.code, PublicSourceControlErrorCode::Cancelled);
        assert!(child_slot.lock().unwrap().is_none());
    }
}
