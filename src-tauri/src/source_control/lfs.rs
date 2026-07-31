use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess};
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(60);
const LIMIT: usize = 128 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlLfsInput {
    pub checkout_path: String,
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
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "lfs",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: TIMEOUT,
        stdout_limit: LIMIT,
        stderr_limit: LIMIT,
        policy: SourceControlExecutionPolicy::TrustedMutation,
    };
    process.run(spec).map(|o| o.stdout)
}

pub fn lfs_action(input: SourceControlLfsInput) -> Result<String, PublicSourceControlError> {
    let path = Path::new(&input.checkout_path);
    match &input.action {
        SourceControlLfsAction::Status => {
            let stdout = run_lfs(&SystemGitProcess, path, &["lfs", "status"])?;
            Ok(String::from_utf8_lossy(&stdout).to_string())
        }
        SourceControlLfsAction::Track => {
            for p in &input.patterns {
                run_lfs(&SystemGitProcess, path, &["lfs", "track", p])?;
            }
            Ok(format!("Tracking {} pattern(s)", input.patterns.len()))
        }
        SourceControlLfsAction::Untrack => {
            for p in &input.patterns {
                run_lfs(&SystemGitProcess, path, &["lfs", "untrack", p])?;
            }
            Ok(format!("Untracked {} pattern(s)", input.patterns.len()))
        }
        SourceControlLfsAction::Fetch => {
            run_lfs(&SystemGitProcess, path, &["lfs", "fetch"])?;
            Ok("Fetched LFS objects".into())
        }
        SourceControlLfsAction::Pull => {
            run_lfs(&SystemGitProcess, path, &["lfs", "pull"])?;
            Ok("Pulled LFS objects".into())
        }
        SourceControlLfsAction::Availability => {
            let stdout = SystemGitProcess
                .discover()
                .map(|_| "available".to_string())
                .unwrap_or_else(|_| "unavailable".into());
            Ok(stdout)
        }
    }
}
