use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess};
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
    pub checkout_path: String,
    pub action: String,
    pub name: String,
    pub target: Option<String>,
    pub force: bool,
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
    };
    process.run(spec).map(|o| o.stdout)
}

pub fn list_refs(checkout_path: String) -> Result<Vec<SourceControlRefSummary>, PublicSourceControlError> {
    let path = Path::new(&checkout_path);
    let stdout = run_ref_op(&SystemGitProcess, path, &["for-each-ref", "--format=%(refname:short)%00%(objectname:short)%00%(upstream:short)%00%(refname:lstrip=2)",
        "refs/heads", "refs/remotes"])?;
    let text = String::from_utf8_lossy(&stdout);
    let mut refs: Vec<SourceControlRefSummary> = Vec::new();
    for line in text.lines() {
        let parts: Vec<&str> = line.split('\0').collect();
        if parts.len() >= 3 {
            let name = parts[0].to_string();
            let oid = parts[1].to_string();
            let upstream = if parts.len() > 2 {
                Some(parts[2].to_string())
            } else {
                None
            };
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
    let current_branch = run_ref_op(
        &SystemGitProcess,
        path,
        &["rev-parse", "--abbrev-ref", "HEAD"],
    )
    .map(|stdout| String::from_utf8_lossy(&stdout).trim().to_string())
    .ok();
    if let Some(ref cur) = current_branch {
        for r in &mut refs {
            r.is_current = r.name == *cur;
        }
    }
    Ok(refs)
}

pub fn mutate_ref(input: SourceControlRefMutationInput) -> Result<SourceControlRefMutationResult, PublicSourceControlError> {
    let path = Path::new(&input.checkout_path);
    match input.action.as_str() {
        "checkout" => {
            run_ref_op(&SystemGitProcess, path, &["checkout", &input.name])?;
            Ok(SourceControlRefMutationResult {
                message: format!("Checked out {}", input.name),
            })
        }
        "create-branch" => {
            let mut args = vec!["branch", &input.name];
            if let Some(ref target) = input.target {
                args.push(target);
            }
            run_ref_op(&SystemGitProcess, path, &args)?;
            Ok(SourceControlRefMutationResult {
                message: format!("Created branch {}", input.name),
            })
        }
        "delete-branch" => {
            let mut args = vec!["branch"];
            if input.force {
                args.push("-D");
            } else {
                args.push("-d");
            }
            args.push(&input.name);
            run_ref_op(&SystemGitProcess, path, &args)?;
            Ok(SourceControlRefMutationResult {
                message: format!("Deleted branch {}", input.name),
            })
        }
        "rename-branch" => {
            if let Some(ref target) = input.target {
                run_ref_op(
                    &SystemGitProcess,
                    path,
                    &["branch", "-m", &input.name, target],
                )?;
            }
            Ok(SourceControlRefMutationResult {
                message: format!(
                    "Renamed branch {} → {}",
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

        let refs = list_refs(dir.path().to_string_lossy().into()).unwrap();
        let branches: Vec<_> = refs
            .iter()
            .filter(|r| matches!(r.kind, SourceControlRefKind::Branch))
            .collect();
        assert!(branches.iter().any(|r| r.name == "main"));
        assert!(branches.iter().any(|r| r.name == "feature/x"));
        assert!(branches.iter().any(|r| r.is_current));
    }
}
