use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope_registry::SourceControlScopeRecord;
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

pub fn validate_relative_pathspec(path: &str) -> Result<PathBuf, PublicSourceControlError> {
    if path.is_empty() || path.contains('\0') || Path::new(path).is_absolute() {
        return Err(PublicSourceControlError::checkout_invalid(
            "mutation",
            "Pathspec must be a non-empty repository-relative path.",
        ));
    }
    for component in Path::new(path).components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(PublicSourceControlError::checkout_invalid(
                    "mutation",
                    "Pathspec must not traverse outside the repository.",
                ));
            }
            _ => {}
        }
    }
    Ok(PathBuf::from(path))
}

pub fn resolve_scoped_target(
    scope: &SourceControlScopeRecord,
    pathspec: &str,
) -> Result<PathBuf, PublicSourceControlError> {
    let relative = validate_relative_pathspec(pathspec)?;
    let checkout = std::fs::canonicalize(&scope.checkout_path).map_err(|_| {
        PublicSourceControlError::checkout_invalid("mutation", "Checkout path is invalid.")
    })?;
    let target = checkout.join(&relative);
    if target.exists() {
        let canonical = std::fs::canonicalize(&target).map_err(|_| {
            PublicSourceControlError::process_failed("mutation", false)
        })?;
        if !canonical.starts_with(&checkout) {
            return Err(PublicSourceControlError::scope_violation("mutation"));
        }
        return Ok(canonical);
    }
    if !target.starts_with(&checkout) {
        return Err(PublicSourceControlError::scope_violation("mutation"));
    }
    Ok(target)
}

fn append_pathspec_args(args: &mut Vec<OsString>, paths: &[String]) -> Result<(), PublicSourceControlError> {
    if paths.is_empty() {
        return Ok(());
    }
    args.push(OsString::from("--"));
    for path in paths {
        validate_relative_pathspec(path)?;
        args.push(OsString::from(path.as_str()));
    }
    Ok(())
}

fn run_mutation(
    process: &impl SourceControlProcess,
    checkout: &Path,
    args: Vec<OsString>,
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec::trusted_mutation(checkout, args);
    process.run(spec).map(|o| o.stdout)
}

fn repository_has_commits(
    process: &impl SourceControlProcess,
    checkout: &Path,
) -> Result<bool, PublicSourceControlError> {
    run_mutation(
        process,
        checkout,
        vec![
            OsString::from("rev-parse"),
            OsString::from("--verify"),
            OsString::from("HEAD"),
        ],
    )
    .map(|_| true)
    .or_else(|error| {
        if error.code == crate::source_control::contracts::PublicSourceControlErrorCode::ProcessFailed {
            Ok(false)
        } else {
            Err(error)
        }
    })
}

fn remove_untracked_target(target: &Path, checkout: &Path) -> Result<(), PublicSourceControlError> {
    let canonical_checkout = std::fs::canonicalize(checkout).map_err(|_| {
        PublicSourceControlError::checkout_invalid("discard", "Checkout path is invalid.")
    })?;
    let canonical_target = if target.exists() {
        std::fs::canonicalize(target).map_err(|_| {
            PublicSourceControlError::process_failed("discard", false)
        })?
    } else {
        target.to_path_buf()
    };
    if !canonical_target.starts_with(&canonical_checkout) {
        return Err(PublicSourceControlError::scope_violation("discard"));
    }
    if !canonical_target.exists() {
        return Ok(());
    }
    if canonical_target.is_dir() {
        std::fs::remove_dir_all(&canonical_target)
            .map_err(|_| PublicSourceControlError::process_failed("discard", false))?;
    } else {
        std::fs::remove_file(&canonical_target)
            .map_err(|_| PublicSourceControlError::process_failed("discard", false))?;
    }
    Ok(())
}

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
    let checkout = scope.checkout_path.as_path();
    if input.paths.is_empty() {
        return Ok(SourceControlMutationResult {
            message: "Nothing to stage".into(),
        });
    }

    let mut args = match input.mode {
        SourceControlStageMode::Stage => vec![OsString::from("add")],
        SourceControlStageMode::Unstage => {
            if repository_has_commits(process, checkout)? {
                vec![OsString::from("reset"), OsString::from("HEAD")]
            } else {
                vec![OsString::from("rm"), OsString::from("--cached")]
            }
        }
    };
    append_pathspec_args(&mut args, &input.paths)?;
    run_mutation(process, checkout, args)?;
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
    let checkout = scope.checkout_path.as_path();
    if input.paths.is_empty() {
        return Ok(SourceControlMutationResult {
            message: "Nothing to discard".into(),
        });
    }
    match input.mode {
        SourceControlDiscardMode::Tracked => {
            let mut args = vec![OsString::from("checkout")];
            append_pathspec_args(&mut args, &input.paths)?;
            run_mutation(process, checkout, args)?;
        }
        SourceControlDiscardMode::Untracked => {
            for pathspec in &input.paths {
                let target = resolve_scoped_target(scope, pathspec)?;
                remove_untracked_target(&target, checkout)?;
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
    let checkout = scope.checkout_path.as_path();
    if let Some(branch) = &input.new_branch {
        run_mutation(
            process,
            checkout,
            vec![
                OsString::from("switch"),
                OsString::from("-c"),
                OsString::from(branch.as_str()),
            ],
        )?;
    }

    let mut args = vec![OsString::from("commit"), OsString::from("--quiet")];
    if input.amend {
        args.push(OsString::from("--amend"));
    }
    if input.signoff {
        args.push(OsString::from("--signoff"));
    }
    if input.selected_paths.is_some() {
        args.push(OsString::from("--only"));
    }
    args.push(OsString::from("-m"));
    args.push(OsString::from(input.subject.as_str()));
    if !input.body.is_empty() {
        args.push(OsString::from("-m"));
        args.push(OsString::from(input.body.as_str()));
    }
    if let Some(selected) = &input.selected_paths {
        append_pathspec_args(&mut args, selected)?;
    }
    run_mutation(process, checkout, args)?;
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
            let mut args = vec![OsString::from("stash"), OsString::from("push")];
            if input.include_untracked {
                args.push(OsString::from("--include-untracked"));
            }
            if let Some(msg) = &input.message {
                args.push(OsString::from("-m"));
                args.push(OsString::from(msg.as_str()));
            }
            run_mutation(process, path, args)?;
            Ok(SourceControlMutationResult {
                message: "Stashed".into(),
            })
        }
        SourceControlStashAction::Apply { index } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(
                process,
                path,
                vec![
                    OsString::from("stash"),
                    OsString::from("apply"),
                    OsString::from(stash_ref),
                ],
            )?;
            Ok(SourceControlMutationResult {
                message: format!("Applied stash@{{{}}}", index),
            })
        }
        SourceControlStashAction::Pop { index } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(
                process,
                path,
                vec![
                    OsString::from("stash"),
                    OsString::from("pop"),
                    OsString::from(stash_ref),
                ],
            )?;
            Ok(SourceControlMutationResult {
                message: format!("Popped stash@{{{}}}", index),
            })
        }
        SourceControlStashAction::Branch { index, branch_name } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(
                process,
                path,
                vec![
                    OsString::from("stash"),
                    OsString::from("branch"),
                    OsString::from(branch_name.as_str()),
                    OsString::from(stash_ref),
                ],
            )?;
            Ok(SourceControlMutationResult {
                message: format!("Created branch {} from stash@{{{}}}", branch_name, index),
            })
        }
        SourceControlStashAction::Drop { index } => {
            let stash_ref = format!("stash@{{{}}}", index);
            run_mutation(
                process,
                path,
                vec![
                    OsString::from("stash"),
                    OsString::from("drop"),
                    OsString::from(stash_ref),
                ],
            )?;
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

    fn scope_for(path: &Path) -> SourceControlScopeRecord {
        scope(path)
    }

    fn git(repo: &Path, args: &[&str]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(args)
            .status()
            .unwrap();
        assert!(status.success(), "git {:?} failed in {:?}", args, repo);
    }

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

    #[test]
    fn discards_multiple_tracked_paths() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("a.txt"), "base").unwrap();
        fs::write(dir.path().join("b.txt"), "base").unwrap();
        git(dir.path(), &["add", "a.txt", "b.txt"]);
        git(dir.path(), &["commit", "-m", "base"]);
        fs::write(dir.path().join("a.txt"), "changed").unwrap();
        fs::write(dir.path().join("b.txt"), "changed").unwrap();

        discard_with(
            &SystemGitProcess,
            SourceControlDiscardInput {
                scope_id: "scope-1".into(),
                paths: vec!["a.txt".into(), "b.txt".into()],
                mode: SourceControlDiscardMode::Tracked,
            },
            &scope_for(dir.path()),
        )
        .unwrap();

        assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "base");
        assert_eq!(fs::read_to_string(dir.path().join("b.txt")).unwrap(), "base");
    }

    #[test]
    fn discards_untracked_file_and_directory_inside_scope() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("solo.txt"), "solo").unwrap();
        fs::create_dir(dir.path().join("nested")).unwrap();
        fs::write(dir.path().join("nested/inner.txt"), "inner").unwrap();

        discard_with(
            &SystemGitProcess,
            SourceControlDiscardInput {
                scope_id: "scope-1".into(),
                paths: vec!["solo.txt".into(), "nested".into()],
                mode: SourceControlDiscardMode::Untracked,
            },
            &scope_for(dir.path()),
        )
        .unwrap();

        assert!(!dir.path().join("solo.txt").exists());
        assert!(!dir.path().join("nested").exists());
    }

    #[test]
    fn rejects_absolute_and_parent_traversing_pathspecs() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("safe.txt"), "x").unwrap();
        let scope = scope_for(dir.path());
        let absolute = dir.path().join("safe.txt").to_string_lossy().into_owned();

        let absolute_err = discard_with(
            &SystemGitProcess,
            SourceControlDiscardInput {
                scope_id: "scope-1".into(),
                paths: vec![absolute],
                mode: SourceControlDiscardMode::Untracked,
            },
            &scope,
        )
        .unwrap_err();
        assert_eq!(
            absolute_err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );

        let parent_err = stage_with(
            &SystemGitProcess,
            SourceControlStageInput {
                scope_id: "scope-1".into(),
                paths: vec!["../outside.txt".into()],
                mode: SourceControlStageMode::Stage,
            },
            &scope,
        )
        .unwrap_err();
        assert_eq!(
            parent_err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );
    }

    #[test]
    fn commits_on_new_branch() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("branch.txt"), "content").unwrap();
        git(dir.path(), &["add", "branch.txt"]);

        commit_with(
            &SystemGitProcess,
            SourceControlCommitInput {
                scope_id: "scope-1".into(),
                subject: "on new branch".into(),
                body: String::new(),
                amend: false,
                signoff: false,
                new_branch: Some("feature/new".into()),
                selected_paths: None,
            },
            &scope_for(dir.path()),
        )
        .unwrap();

        let head = Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "symbolic-ref",
                "--short",
                "HEAD",
            ])
            .output()
            .unwrap();
        assert_eq!(
            String::from_utf8_lossy(&head.stdout).trim(),
            "feature/new"
        );
    }

    #[test]
    fn selected_file_commit_preserves_unrelated_staged_change() {
        let dir = tempdir().unwrap();
        init(dir.path());
        fs::write(dir.path().join("a.txt"), "a-base").unwrap();
        fs::write(dir.path().join("b.txt"), "b-base").unwrap();
        git(dir.path(), &["add", "a.txt", "b.txt"]);
        git(dir.path(), &["commit", "-m", "base"]);
        fs::write(dir.path().join("a.txt"), "a-next").unwrap();
        fs::write(dir.path().join("b.txt"), "b-next").unwrap();
        git(dir.path(), &["add", "a.txt", "b.txt"]);

        commit_with(
            &SystemGitProcess,
            SourceControlCommitInput {
                scope_id: "scope-1".into(),
                subject: "only a".into(),
                body: String::new(),
                amend: false,
                signoff: false,
                new_branch: None,
                selected_paths: Some(vec!["a.txt".into()]),
            },
            &scope_for(dir.path()),
        )
        .unwrap();

        let staged = Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "diff",
                "--staged",
                "--name-only",
            ])
            .output()
            .unwrap();
        let staged_names = String::from_utf8_lossy(&staged.stdout);
        assert!(staged_names.contains("b.txt"));
        assert!(!staged_names.contains("a.txt"));

        let log = Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "show",
                "--name-only",
                "--pretty=format:",
                "HEAD",
            ])
            .output()
            .unwrap();
        let committed = String::from_utf8_lossy(&log.stdout);
        assert!(committed.contains("a.txt"));
        assert!(!committed.contains("b.txt"));
    }
}
