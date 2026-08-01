use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::coordinator::{
    SourceControlOperationContext, SourceControlOperationCoordinatorState,
};
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope_registry::SourceControlScopeRecord;
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
    pub scope_id: String,
    pub prune: bool,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlPullInput {
    pub scope_id: String,
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
pub struct SourceControlPushInput {
    pub scope_id: String,
    pub remote: Option<String>,
    pub refspec: Option<String>,
    pub set_upstream: bool,
    pub force_with_lease: Option<String>,
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
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<Vec<u8>, PublicSourceControlError> {
    let mut spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "remote",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: REMOTE_TIMEOUT,
        stdout_limit: REMOTE_LIMIT,
        stderr_limit: REMOTE_LIMIT,
        policy: SourceControlExecutionPolicy::BackgroundNetwork,
        cancellation: None,
        child_slot: None,
    };
    if let Some((ctx, coordinator)) = operation {
        if let Some(slot) = coordinator.child_slot(&ctx.operation_id) {
            spec = spec.attach_operation(ctx.cancellation.clone(), slot);
        }
    }
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
        cancellation: None,
        child_slot: None,
    };
    process.run(spec).map(|o| o.stdout)
}

pub fn git_fetch(
    input: SourceControlFetchInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    git_fetch_with(&SystemGitProcess, input, scope, None)
}

pub fn git_fetch_with(
    process: &impl SourceControlProcess,
    input: SourceControlFetchInput,
    scope: &SourceControlScopeRecord,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let mut args = vec!["fetch"];
    if input.prune {
        args.push("--prune");
    }
    if let Some(remote) = &input.remote {
        args.push(remote);
    }
    run_remote(process, path, &args, operation)?;
    Ok(SourceControlRemoteResult {
        message: "Fetched".into(),
    })
}

pub fn git_pull(
    input: SourceControlPullInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    git_pull_with(&SystemGitProcess, input, scope, None)
}

pub fn git_pull_with(
    process: &impl SourceControlProcess,
    input: SourceControlPullInput,
    scope: &SourceControlScopeRecord,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let mut args = vec!["pull"];
    if matches!(input.strategy, SourceControlPullStrategy::FfOnly) {
        args.push("--ff-only");
    }
    if input.rebase {
        args.push("--rebase");
    }
    run_remote(process, path, &args, operation)?;
    Ok(SourceControlRemoteResult {
        message: "Pulled".into(),
    })
}

pub fn git_push(
    input: SourceControlPushInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    git_push_with(&SystemGitProcess, input, scope, None)
}

pub fn git_push_with(
    process: &impl SourceControlProcess,
    input: SourceControlPushInput,
    scope: &SourceControlScopeRecord,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<SourceControlRemoteResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let mut args = vec!["push"];
    if input.set_upstream {
        args.push("--set-upstream");
    }
    if let Some(expected_oid) = &input.force_with_lease {
        args.push("--force-with-lease");
        if !expected_oid.is_empty() {
            args.push(expected_oid);
        }
    }
    if let Some(remote) = &input.remote {
        args.push(remote);
    }
    if let Some(refspec) = &input.refspec {
        args.push(refspec);
    }
    run_remote(process, path, &args, operation)?;
    Ok(SourceControlRemoteResult {
        message: "Pushed".into(),
    })
}
#[allow(dead_code)]
pub fn list_remotes(
    scope: &SourceControlScopeRecord,
) -> Result<Vec<String>, PublicSourceControlError> {
    list_remotes_with(&SystemGitProcess, scope)
}

#[allow(dead_code)]
pub fn list_remotes_with(
    process: &impl SourceControlProcess,
    scope: &SourceControlScopeRecord,
) -> Result<Vec<String>, PublicSourceControlError> {
    let stdout = run_read(process, scope.checkout_path.as_path(), &["remote"])?;
    Ok(String::from_utf8_lossy(&stdout)
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect())
}
