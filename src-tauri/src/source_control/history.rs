use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope_registry::SourceControlScopeRecord;
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

const HISTORY_TIMEOUT: Duration = Duration::from_secs(30);
const HISTORY_LIMIT: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlLogEntry {
    pub oid: String,
    pub short_oid: String,
    pub subject: String,
    pub author: String,
    pub date_iso: String,
    pub refs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlLogInput {
    pub scope_id: String,
    pub max_count: usize,
    pub branch: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCompareInput {
    pub scope_id: String,
    pub base: String,
    pub head: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCompareResult {
    pub ahead: u64,
    pub behind: u64,
    pub commits: Vec<String>,
}

// Scaffolding for the history-action track; not yet wired into lib.rs.
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceControlHistoryAction {
    Checkout { oid: String },
    Revert { oid: String },
    CherryPick { oid: String },
    Reset { mode: String, oid: String },
}

fn run_history(
    process: &impl SourceControlProcess,
    checkout: &Path,
    args: &[&str],
) -> Result<Vec<u8>, PublicSourceControlError> {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "history",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: HISTORY_TIMEOUT,
        stdout_limit: HISTORY_LIMIT,
        stderr_limit: HISTORY_LIMIT,
        policy: SourceControlExecutionPolicy::ParsedRead,
        cancellation: None,
        child_slot: None,
    };
    process.run(spec).map(|o| o.stdout)
}

pub fn git_log(
    input: SourceControlLogInput,
    scope: &SourceControlScopeRecord,
) -> Result<Vec<SourceControlLogEntry>, PublicSourceControlError> {
    git_log_with(&SystemGitProcess, input, scope)
}

pub fn git_log_with(
    process: &impl SourceControlProcess,
    input: SourceControlLogInput,
    scope: &SourceControlScopeRecord,
) -> Result<Vec<SourceControlLogEntry>, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let count = input.max_count.to_string();
    let mut args = vec![
        "log",
        "--oneline",
        "--decorate=short",
        "--format=%H%x00%h%x00%s%x00%an%x00%aI%x00%D",
        "-n",
        &count,
    ];
    if let Some(branch) = &input.branch {
        args.push(branch);
    }
    if let Some(search) = &input.search {
        args.push("--grep");
        args.push(search);
    }
    let stdout = run_history(process, path, &args)?;
    let text = String::from_utf8_lossy(&stdout);
    let mut entries = Vec::new();
    for line in text.lines() {
        let parts: Vec<&str> = line.split('\0').collect();
        if parts.len() >= 5 {
            entries.push(SourceControlLogEntry {
                oid: parts[0].to_string(),
                short_oid: parts[1].to_string(),
                subject: parts[2].to_string(),
                author: parts[3].to_string(),
                date_iso: parts[4].to_string(),
                refs: if parts.len() > 5 {
                    parts[5]
                        .split(',')
                        .map(|r| r.trim().to_string())
                        .filter(|r| !r.is_empty())
                        .collect()
                } else {
                    Vec::new()
                },
            });
        }
    }
    Ok(entries)
}

pub fn git_compare(
    input: SourceControlCompareInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlCompareResult, PublicSourceControlError> {
    git_compare_with(&SystemGitProcess, input, scope)
}

pub fn git_compare_with(
    process: &impl SourceControlProcess,
    input: SourceControlCompareInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlCompareResult, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let range = format!("{}...{}", input.base, input.head);
    let counts = run_history(
        process,
        path,
        &["rev-list", "--left-right", "--count", &range],
    )?;
    let count_text = String::from_utf8_lossy(&counts).trim().to_string();
    let mut counts_iter = count_text.split('\t');
    let ahead = counts_iter
        .next()
        .and_then(|part| part.parse().ok())
        .unwrap_or(0);
    let behind = counts_iter
        .next()
        .and_then(|part| part.parse().ok())
        .unwrap_or(0);
    let commits_out = run_history(
        process,
        path,
        &["rev-list", "--format=%s", "--max-count=100", &range],
    )?;
    let commits = String::from_utf8_lossy(&commits_out)
        .lines()
        .filter(|line| !line.starts_with("commit "))
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();
    Ok(SourceControlCompareResult {
        ahead,
        behind,
        commits,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    #[test]
    fn lists_commits() {
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
        fs::write(dir.path().join("a.txt"), "a").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "a.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "first"])
            .status()
            .unwrap();
        fs::write(dir.path().join("b.txt"), "b").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "b.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "second"])
            .status()
            .unwrap();

        let entries = git_log(
            SourceControlLogInput {
                scope_id: "scope-1".into(),
                max_count: 10,
                branch: None,
                search: None,
            },
            &scope,
        )
        .unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].subject, "second");
        assert_eq!(entries[1].subject, "first");
    }
}
