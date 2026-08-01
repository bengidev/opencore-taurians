use crate::source_control::contracts::PublicSourceControlError;
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
pub struct SourceControlSubmoduleInput {
    pub scope_id: String,
    pub action: SourceControlSubmoduleAction,
    pub recursive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlSubmoduleAction {
    Init,
    Update,
    Sync,
    Deinit,
    Status,
}

fn run_sm(
    process: &impl SourceControlProcess,
    checkout: &Path,
    args: &[&str],
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "submodule",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: TIMEOUT,
        stdout_limit: LIMIT,
        stderr_limit: LIMIT,
        policy: SourceControlExecutionPolicy::TrustedMutation,
    };
    process.run(spec).map(|o| o.stdout)
}

pub fn submodule_action(
    input: SourceControlSubmoduleInput,
    scope: &SourceControlScopeRecord,
) -> Result<String, PublicSourceControlError> {
    submodule_action_with(&SystemGitProcess, input, scope)
}

pub fn submodule_action_with(
    process: &impl SourceControlProcess,
    input: SourceControlSubmoduleInput,
    scope: &SourceControlScopeRecord,
) -> Result<String, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let action = match input.action {
        SourceControlSubmoduleAction::Init => "init",
        SourceControlSubmoduleAction::Update => "update",
        SourceControlSubmoduleAction::Sync => "sync",
        SourceControlSubmoduleAction::Deinit => "deinit",
        SourceControlSubmoduleAction::Status => "status",
    };
    let mut args = vec!["submodule", action];
    if input.recursive {
        args.push("--recursive");
    }
    let stdout = run_sm(process, path, &args)?;
    Ok(String::from_utf8_lossy(&stdout).to_string())
}
