use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope_registry::SourceControlScopeRecord;
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

const MUTATION_TIMEOUT: Duration = Duration::from_secs(60);
const OUTPUT_LIMIT: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlStageInput {
    pub scope_id: String,
    pub paths: Vec<String>,
    pub mode: SourceControlStageMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlStageMode {
    Stage,
    Unstage,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlDiscardInput {
    pub scope_id: String,
    pub paths: Vec<String>,
    pub mode: SourceControlDiscardMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlDiscardMode {
    Tracked,
    Untracked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCommitInput {
    pub scope_id: String,
    pub subject: String,
    pub body: String,
    pub amend: bool,
    pub signoff: bool,
    pub new_branch: Option<String>,
    pub selected_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlStashInput {
    pub scope_id: String,
    pub message: Option<String>,
    pub include_untracked: bool,
    pub action: SourceControlStashAction,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlStashAction {
    Create,
    Apply { index: usize },
    Pop { index: usize },
    Branch { index: usize, branch_name: String },
    Drop { index: usize },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlMutationResult {
    pub message: String,
}

fn run_mutation(
    process: &impl SourceControlProcess,
    checkout: &Path,
    args: &[&str],
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "mutation",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: MUTATION_TIMEOUT,
        stdout_limit: OUTPUT_LIMIT,
        stderr_limit: OUTPUT_LIMIT,
        policy: SourceControlExecutionPolicy::TrustedMutation,
    };
    process.run(spec).map(|o| o.stdout)
}

pub fn stage(
    input: SourceControlStageInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    stage_with(&SystemGitProcess, input, scope)
}

pub fn stage_with(
    process: &impl SourceControlProcess,
    input: SourceControlStageInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let mut args = vec![match input.mode {
        SourceControlStageMode::Stage => "add",
        SourceControlStageMode::Unstage => "reset",
    }];
    args.extend(input.paths.iter().map(|p| p.as_str()));
    run_mutation(process, path, &args)?;
    Ok(SourceControlMutationResult {
        message: format!(
            "{} {} file(s)",
            match input.mode {
                SourceControlStageMode::Stage => "Staged",
                SourceControlStageMode::Unstage => "Unstaged",
            },
            input.paths.len()
        ),
    })
}

pub fn discard(
    input: SourceControlDiscardInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    discard_with(&SystemGitProcess, input, scope)
}

pub fn discard_with(
    process: &impl SourceControlProcess,
    input: SourceControlDiscardInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    if input.paths.is_empty() {
        return Ok(SourceControlMutationResult {
            message: "Nothing to discard".into(),
        });
    }
    match input.mode {
        SourceControlDiscardMode::Tracked => {
            run_mutation(process, path, &["checkout", "--", &input.paths.join(",")])?;
        }
        SourceControlDiscardMode::Untracked => {
            for p in &input.paths {
                let target = path.join(p);
                if target.exists() {
                    std::fs::remove_file(&target)
                        .map_err(|_| PublicSourceControlError::process_failed("discard", false))?;
                }
            }
        }
    }
    Ok(SourceControlMutationResult {
        message: format!("Discarded {} file(s)", input.paths.len()),
    })
}

pub fn commit(
    input: SourceControlCommitInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    commit_with(&SystemGitProcess, input, scope)
}

pub fn commit_with(
    process: &impl SourceControlProcess,
    input: SourceControlCommitInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let mut args: Vec<&str> = vec!["commit", "--quiet"];
    if input.amend {
        args.push("--amend");
    }
    if input.signoff {
        args.push("--signoff");
    }
    args.push("-m");
    args.push(&input.subject);
    if !input.body.is_empty() {
        args.push("-m");
        args.push(&input.body);
    }
    if let Some(branch) = &input.new_branch {
        args.push("-b");
        args.push(branch);
    }
    if let Some(selected) = &input.selected_paths {
        run_mutation(process, path, &["add", "--"]).ok();
        let joined: Vec<&str> = selected.iter().map(|s| s.as_str()).collect();
        let mut add_args = vec!["add"];
        add_args.extend(&joined);
        run_mutation(process, path, &add_args)?;
    }
    run_mutation(process, path, &args)?;
    Ok(SourceControlMutationResult {
        message: "Committed".into(),
    })
}

pub fn stash(
    input: SourceControlStashInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    stash_with(&SystemGitProcess, input, scope)
}

pub fn stash_with(
    process: &impl SourceControlProcess,
    input: SourceControlStashInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlMutationResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    match input.action {
        SourceControlStashAction::Create => {
            let mut args = vec!["stash", "push"];
            if input.include_untracked {
                args.push("--include-untracked");
            }
            if let Some(msg) = &input.message {
                args.push("-m");
                args.push(msg);
            }
            run_mutation(process, path, &args)?;
            Ok(SourceControlMutationResult {
                message: "Stashed".into(),
            })
        }
        SourceControlStashAction::Apply { index } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(process, path, &["stash", "apply", &stash_ref])?;
            Ok(SourceControlMutationResult {
                message: format!("Applied stash@{{{}}}", index),
            })
        }
        SourceControlStashAction::Pop { index } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(process, path, &["stash", "pop", &stash_ref])?;
            Ok(SourceControlMutationResult {
                message: format!("Popped stash@{{{}}}", index),
            })
        }
        SourceControlStashAction::Branch { index, branch_name } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(
                process,
                path,
                &["stash", "branch", &branch_name, &stash_ref],
            )?;
            Ok(SourceControlMutationResult {
                message: format!("Created branch {} from stash@{{{}}}", branch_name, index),
            })
        }
        SourceControlStashAction::Drop { index } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(process, path, &["stash", "drop", &stash_ref])?;
            Ok(SourceControlMutationResult {
                message: format!("Dropped stash@{{{}}}", index),
            })
        }
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
    fn scope(path: &Path) -> SourceControlScopeRecord {
        SourceControlScopeRecord {
            scope_id: "scope-1".into(),
            project_id: "p".into(),
            trunk_id: "t".into(),
            project_root: path.to_path_buf(),
            checkout_path: path.to_path_buf(),
            checkout_identity: "checkout-1".into(),
            repository_identity: None,
            managed_by_app: false,
        }
    }

    // (placeholder: real tests write files before staging to avoid "pathspec did not match" errors)

    #[test]
    fn stages_and_unstages_files() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("f.txt"), "x").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "f.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "base"])
            .status()
            .unwrap();
        fs::write(dir.path().join("f.txt"), "y").unwrap();

        stage(
            SourceControlStageInput {
                scope_id: "scope-1".into(),
                paths: vec!["f.txt".into()],
                mode: SourceControlStageMode::Stage,
            },
            &scope(dir.path()),
        )
        .unwrap();
        // Verify index matches working tree
        let out = Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "diff",
                "--staged",
                "--name-only",
            ])
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&out.stdout).contains("f.txt"));

        stage(
            SourceControlStageInput {
                scope_id: "scope-1".into(),
                paths: vec!["f.txt".into()],
                mode: SourceControlStageMode::Unstage,
            },
            &scope(dir.path()),
        )
        .unwrap();
        let out = Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "diff",
                "--staged",
                "--name-only",
            ])
            .output()
            .unwrap();
        assert!(!String::from_utf8_lossy(&out.stdout).contains("f.txt"));
    }

    #[test]
    fn commits_with_subject() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("g.txt"), "hello").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "g.txt"])
            .status()
            .unwrap();

        commit(
            SourceControlCommitInput {
                scope_id: "scope-1".into(),
                subject: "feat: hello".into(),
                body: String::new(),
                amend: false,
                signoff: false,
                new_branch: None,
                selected_paths: None,
            },
            &scope(dir.path()),
        )
        .unwrap();

        let out = Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "log", "--oneline", "-1"])
            .output()
            .unwrap();
        assert!(String::from_utf8_lossy(&out.stdout).contains("feat: hello"));
    }

    #[test]
    fn creates_and_applies_stash() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("h.txt"), "initial").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "h.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "base"])
            .status()
            .unwrap();
        fs::write(dir.path().join("h.txt"), "stashed").unwrap();

        stash(
            SourceControlStashInput {
                scope_id: "scope-1".into(),
                message: Some("wip".into()),
                include_untracked: false,
                action: SourceControlStashAction::Create,
            },
            &scope(dir.path()),
        )
        .unwrap();
        let content = fs::read_to_string(dir.path().join("h.txt")).unwrap();
        assert_eq!(content.trim(), "initial"); // reverted after stash

        stash(
            SourceControlStashInput {
                scope_id: "scope-1".into(),
                message: None,
                include_untracked: false,
                action: SourceControlStashAction::Pop { index: 0 },
            },
            &scope(dir.path()),
        )
        .unwrap();
        let content = fs::read_to_string(dir.path().join("h.txt")).unwrap();
        assert_eq!(content.trim(), "stashed");
    }
}
