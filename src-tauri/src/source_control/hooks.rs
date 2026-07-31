use crate::source_control::contracts::PublicSourceControlError;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlHookInfo {
    pub path: String,
    pub present: bool,
}

/// Enumerate hooks present in a repository without executing any.
/// Only returns existence metadata — never runs a hook.
pub fn enumerate_hooks(checkout_path: &str) -> Result<Vec<SourceControlHookInfo>, PublicSourceControlError> {
    let hooks_dir = Path::new(checkout_path).join(".git").join("hooks");
    if !hooks_dir.exists() {
        return Ok(Vec::new());
    }

    let predefined = [
        "applypatch-msg",
        "pre-applypatch",
        "post-applypatch",
        "pre-commit",
        "pre-merge-commit",
        "prepare-commit-msg",
        "commit-msg",
        "post-commit",
        "pre-rebase",
        "post-checkout",
        "post-merge",
        "pre-push",
        "pre-receive",
        "update",
        "post-receive",
        "post-update",
        "reference-transaction",
        "push-to-checkout",
        "pre-auto-gc",
        "post-rewrite",
        "sendemail-validate",
        "fsmonitor-watchman",
        "p4-changelist",
        "p4-prepare-changelist",
        "p4-post-changelist",
        "p4-submit",
    ];

    let mut hooks = Vec::new();
    for name in &predefined {
        let path = hooks_dir.join(name);
        hooks.push(SourceControlHookInfo {
            path: path.to_string_lossy().into_owned(),
            present: path.exists(),
        });
    }
    Ok(hooks)
}

// Scaffolding for the hook-trust track; not yet wired into lib.rs.
#[allow(dead_code)]
/// Check whether a hook path is trusted by the user.
/// Hooks are NEVER executed from this module; this is a read-only check.
pub fn is_hook_trusted(_hook_path: &str, _user_trusted: bool) -> bool {
    // Default policy: no hooks are trusted until explicitly opted in.
    // The UI presents the hook list and lets the user decide which to trust.
    _user_trusted
}

// Scaffolding for the git-availability track; used by hook-trust UI later.
#[allow(dead_code)]
/// Check if SourceControl is available on the system.
pub fn detect_git_available() -> bool {
    Command::new("git")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn enumerates_present_hooks() {
        let dir = tempdir().unwrap();
        Command::new("git")
            .args(["init", "-q", "-b", "main"])
            .arg(dir.path())
            .status()
            .unwrap();
        Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "config",
                "user.email",
                "t@t.com",
            ])
            .status()
            .unwrap();
        Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "config",
                "user.name",
                "T",
            ])
            .status()
            .unwrap();

        // No hooks by default
        let hooks = enumerate_hooks(dir.path().to_str().unwrap()).unwrap();
        assert!(hooks.iter().all(|h| !h.present));

        // Create a pre-commit hook
        fs::create_dir_all(dir.path().join(".git").join("hooks")).unwrap();
        fs::write(
            dir.path().join(".git").join("hooks").join("pre-commit"),
            "#!/bin/sh\necho test",
        )
        .unwrap();

        let hooks = enumerate_hooks(dir.path().to_str().unwrap()).unwrap();
        let pre_commit = hooks
            .iter()
            .find(|h| h.path.contains("pre-commit"))
            .unwrap();
        assert!(pre_commit.present);
    }

    #[test]
    fn detect_git_available_on_ci() {
        assert!(detect_git_available());
    }
}
