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

const TIMEOUT: Duration = Duration::from_secs(60);
const LIMIT: usize = 128 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlLfsInput {
    pub scope_id: String,
    pub action: SourceControlLfsAction,
    pub patterns: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlLfsAction {
    Track,
    Untrack,
    Fetch,
    Pull,
    Status,
    Availability,
}

fn run_lfs(
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
        operation: "lfs",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: TIMEOUT,
        stdout_limit: LIMIT,
        stderr_limit: LIMIT,
        policy: SourceControlExecutionPolicy::TrustedMutation,
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

pub fn lfs_action(
    input: SourceControlLfsInput,
    scope: &SourceControlScopeRecord,
) -> Result<String, PublicSourceControlError> {
    lfs_action_with(&SystemGitProcess, input, scope, None)
}

pub fn lfs_action_with(
    process: &impl SourceControlProcess,
    input: SourceControlLfsInput,
    scope: &SourceControlScopeRecord,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<String, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    match &input.action {
        SourceControlLfsAction::Status => {
            let stdout = run_lfs(process, path, &["lfs", "status"], None)?;
            Ok(String::from_utf8_lossy(&stdout).to_string())
        }
        SourceControlLfsAction::Track => {
            for pattern in &input.patterns {
                run_lfs(process, path, &["lfs", "track", pattern], operation)?;
            }
            Ok(format!("Tracking {} pattern(s)", input.patterns.len()))
        }
        SourceControlLfsAction::Untrack => {
            for pattern in &input.patterns {
                run_lfs(process, path, &["lfs", "untrack", pattern], operation)?;
            }
            Ok(format!("Untracked {} pattern(s)", input.patterns.len()))
        }
        SourceControlLfsAction::Fetch => {
            run_lfs(process, path, &["lfs", "fetch"], operation)?;
            Ok("Fetched LFS objects".into())
        }
        SourceControlLfsAction::Pull => {
            run_lfs(process, path, &["lfs", "pull"], operation)?;
            Ok("Pulled LFS objects".into())
        }
        SourceControlLfsAction::Availability => Ok(run_lfs(process, path, &["lfs", "version"], None)
            .map(|_| "available".to_string())
            .unwrap_or_else(|_| "unavailable".into())),
    }
}
