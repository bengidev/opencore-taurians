use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess};
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

const REMOTE_TIMEOUT: Duration = Duration::from_secs(120);
const REMOTE_LIMIT: usize = 512 * 1024;
// Scaffolding for the read-remote track; not yet wired into lib.rs.
#[allow(dead_code)]
const READ_TIMEOUT: Duration = Duration::from_secs(30);
// Scaffolding for the read-remote track; not yet wired into lib.rs.
#[allow(dead_code)]
const READ_LIMIT: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlFetchInput {
    pub checkout_path: String,
    pub prune: bool,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlPullInput {
    pub checkout_path: String,
    pub strategy: SourceControlPullStrategy,
    pub rebase: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlPullStrategy {
    FfOnly,
    Merge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
// Fields are camelCase to match the JSON boundary with the Tauri/JS layer.
#[allow(non_snake_case)]
pub struct SourceControlPushInput {
    pub checkout_path: String,
    pub remote: Option<String>,
    pub refspec: Option<String>,
    pub setUpstream: bool,
    pub forceWithLease: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRemoteResult {
    pub message: String,
}

fn run_remote(
    process: &impl SourceControlProcess,
    checkout: &Path,
    args: &[&str],
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "remote",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: REMOTE_TIMEOUT,
        stdout_limit: REMOTE_LIMIT,
        stderr_limit: REMOTE_LIMIT,
        policy: SourceControlExecutionPolicy::BackgroundNetwork,
    };
    process.run(spec).map(|o| o.stdout)
}

// Scaffolding for the read-remote track; not yet wired into lib.rs.
#[allow(dead_code)]
fn run_read(
    process: &impl SourceControlProcess,
    checkout: &Path,
    args: &[&str],
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "read",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: READ_TIMEOUT,
        stdout_limit: READ_LIMIT,
        stderr_limit: READ_LIMIT,
        policy: SourceControlExecutionPolicy::ParsedRead,
    };
    process.run(spec).map(|o| o.stdout)
}

pub fn git_fetch(input: SourceControlFetchInput) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    let path = Path::new(&input.checkout_path);
    let mut args = vec!["fetch"];
    if input.prune {
        args.push("--prune");
    }
    if let Some(ref remote) = input.remote {
        args.push(remote);
    }
    run_remote(&SystemGitProcess, path, &args)?;
    Ok(SourceControlRemoteResult {
        message: "Fetched".into(),
    })
}

pub fn git_pull(input: SourceControlPullInput) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    let path = Path::new(&input.checkout_path);
    let mut args = vec!["pull"];
    match input.strategy {
        SourceControlPullStrategy::FfOnly => {
            args.push("--ff-only");
        }
        SourceControlPullStrategy::Merge => {}
    }
    if input.rebase {
        args.push("--rebase");
    }
    run_remote(&SystemGitProcess, path, &args)?;
    Ok(SourceControlRemoteResult {
        message: "Pulled".into(),
    })
}

pub fn git_push(input: SourceControlPushInput) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    let path = Path::new(&input.checkout_path);
    let mut args = vec!["push"];
    if input.setUpstream {
        args.push("--set-upstream");
    }
    if let Some(ref expected_oid) = input.forceWithLease {
        args.push("--force-with-lease");
        if !expected_oid.is_empty() {
            args.push(expected_oid);
        }
    }
    if let Some(ref remote) = input.remote {
        args.push(remote);
    }
    if let Some(ref refspec) = input.refspec {
        args.push(refspec);
    }
    run_remote(&SystemGitProcess, path, &args)?;
    Ok(SourceControlRemoteResult {
        message: "Pushed".into(),
    })
}

// Scaffolding for the read-remote track; not yet wired into lib.rs.
#[allow(dead_code)]
pub fn list_remotes(checkout_path: String) -> Result<Vec<String>, PublicSourceControlError> {
    let path = Path::new(&checkout_path);
    let stdout = run_read(&SystemGitProcess, path, &["remote"])?;
    Ok(String::from_utf8_lossy(&stdout)
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}
