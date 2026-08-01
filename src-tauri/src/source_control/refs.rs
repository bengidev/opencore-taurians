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

const REF_TIMEOUT: Duration = Duration::from_secs(30);
const REF_LIMIT: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRefSummary {
    pub name: String,
    pub kind: SourceControlRefKind,
    pub oid: String,
    pub upstream: Option<String>,
    pub is_current: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlRefKind {
    Branch,
    Remote,
    Tag,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRefMutationInput {
    pub scope_id: String,
    pub action: String,
    pub name: String,
    pub target: Option<String>,
    pub force: bool,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRefsInput {
    pub scope_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRefMutationResult {
    pub message: String,
}

fn run_ref_op(
    process: &impl SourceControlProcess,
    checkout: &Path,
    args: &[&str],
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "refs",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: REF_TIMEOUT,
        stdout_limit: REF_LIMIT,
        stderr_limit: REF_LIMIT,
        policy: SourceControlExecutionPolicy::ParsedRead,
        cancellation: None,
        child_slot: None,
    };
    process.run(spec).map(|o| o.stdout)
}

fn run_ref_mutation(
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
        operation: "refs",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: REF_TIMEOUT,
        stdout_limit: REF_LIMIT,
        stderr_limit: REF_LIMIT,
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

pub fn list_refs(
    scope: &SourceControlScopeRecord,
) -> Result<Vec<SourceControlRefSummary>, PublicSourceControlError> {
    list_refs_with(&SystemGitProcess, scope)
}

pub fn list_refs_with(
    process: &impl SourceControlProcess,
    scope: &SourceControlScopeRecord,
) -> Result<Vec<SourceControlRefSummary>, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let stdout = run_ref_op(process, path, &["for-each-ref", "--format=%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(refname:lstrip=2)", "refs/heads", "refs/remotes"])?;
    let text = String::from_utf8_lossy(&stdout);
    let mut refs = Vec::new();
    for line in text.lines() {
        let parts: Vec<&str> = line.split('\0').collect();
        if parts.len() >= 3 {
            let name = parts[0].to_string();
            let oid = parts[1].to_string();
            let upstream = Some(parts[2].to_string());
            let kind = if name.starts_with("origin/") {
                SourceControlRefKind::Remote
            } else {
                SourceControlRefKind::Branch
            };
            refs.push(SourceControlRefSummary {
                name,
                kind,
                oid,
                upstream,
                is_current: false,
            });
        }
    }
    let current_branch = run_ref_op(process, path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|stdout| String::from_utf8_lossy(&stdout).trim().to_string())
        .ok();
    if let Some(cur) = current_branch {
        for item in &mut refs {
            item.is_current = item.name == cur;
        }
    }
    Ok(refs)
}

pub fn mutate_ref_with(
    process: &impl SourceControlProcess,
    input: SourceControlRefMutationInput,
    scope: &SourceControlScopeRecord,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<SourceControlRefMutationResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    match input.action.as_str() {
        "checkout" => {
            run_ref_mutation(process, path, &["checkout", &input.name], operation)?;
            Ok(SourceControlRefMutationResult {
                message: format!("Checked out {}", input.name),
            })
        }
        "create-branch" => {
            let mut args = vec!["branch", input.name.as_str()];
            if let Some(target) = &input.target {
                args.push(target);
            }
            run_ref_mutation(process, path, &args, operation)?;
            Ok(SourceControlRefMutationResult {
                message: format!("Created branch {}", input.name),
            })
        }
        "delete-branch" => {
            let args = vec![
                "branch",
                if input.force { "-D" } else { "-d" },
                input.name.as_str(),
            ];
            run_ref_mutation(process, path, &args, operation)?;
            Ok(SourceControlRefMutationResult {
                message: format!("Deleted branch {}", input.name),
            })
        }
        "rename-branch" => {
            if let Some(target) = &input.target {
                run_ref_mutation(
                    process,
                    path,
                    &["branch", "-m", &input.name, target],
                    operation,
                )?;
            }
            Ok(SourceControlRefMutationResult {
                message: format!(
                    "Renamed branch {} -> {}",
                    input.name,
                    input.target.unwrap_or_default()
                ),
            })
        }
        _ => Err(PublicSourceControlError::process_failed("refs", false)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    fn init(path: &Path) {
        Command::new("git")
            .args(["init", "-q", "-b", "main"])
            .arg(path)
            .status()
            .unwrap();
        Command::new("git")
            .args([
                "-C",
                path.to_str().unwrap(),
                "config",
                "user.email",
                "t@t.com",
            ])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", path.to_str().unwrap(), "config", "user.name", "T"])
            .status()
            .unwrap();
    }

    #[test]
    fn lists_branches() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("f.txt"), "x").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "f.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "init"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "branch", "feature/x"])
            .status()
            .unwrap();

        let scope = SourceControlScopeRecord {
            scope_id: "scope-1".into(),
            project_id: "p".into(),
            trunk_id: "t".into(),
            project_root: dir.path().to_path_buf(),
            checkout_path: dir.path().to_path_buf(),
            checkout_identity: "checkout-1".into(),
            repository_identity: None,
            managed_by_app: false,
        };
        let refs = list_refs(&scope).unwrap();
        let branches: Vec<_> = refs
            .iter()
            .filter(|r| matches!(r.kind, SourceControlRefKind::Branch))
            .collect();
        assert!(branches.iter().any(|r| r.name == "main"));
        assert!(branches.iter().any(|r| r.name == "feature/x"));
        assert!(branches.iter().any(|r| r.is_current));
    }
}
