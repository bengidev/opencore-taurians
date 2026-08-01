use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope_registry::SourceControlScopeRecord;
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

const DIFF_TIMEOUT: Duration = Duration::from_secs(30);
const DEFAULT_MAX_BYTES: usize = 512 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceControlDiffSource {
    WorkingTree,
    Staged,
    BranchRange {
        base_ref: String,
        head_ref: Option<String>,
    },
    Commit {
        oid: String,
    },
    CommitRange {
        base_oid: String,
        head_oid: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlDiffInput {
    pub scope_id: String,
    pub source: SourceControlDiffSource,
    pub ignore_whitespace: bool,
    pub max_bytes: usize,
    /// When set, restricts the diff to the given path (relative to the
    /// checkout root). For untracked files under `WorkingTree`, the backend
    /// synthesizes a patch since `git diff` ignores untracked files.
    #[serde(default)]
    pub pathspec: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlDiffFileSummary {
    pub path: String,
    pub old_path: Option<String>,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
    pub binary: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlDiffResult {
    pub source: SourceControlDiffSource,
    pub patch: String,
    pub files: Vec<SourceControlDiffFileSummary>,
    pub additions: u64,
    pub deletions: u64,
    pub binary: bool,
    pub truncated: bool,
}

pub fn get_diff(
    input: SourceControlDiffInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlDiffResult, PublicSourceControlError> {
    get_diff_with(&SystemGitProcess, input, scope)
}

pub fn get_diff_with(
    process: &impl SourceControlProcess,
    input: SourceControlDiffInput,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlDiffResult, PublicSourceControlError> {
    let checkout = scope.checkout_path.as_path();
    let max_bytes = if input.max_bytes == 0 {
        DEFAULT_MAX_BYTES
    } else {
        input.max_bytes
    };
    let numstat_limit = max_bytes.max(DEFAULT_MAX_BYTES);

    let mut args: Vec<OsString> = vec!["diff".into()];
    if input.ignore_whitespace {
        args.push("-w".into());
    }

    let (mut numstat_args, source_description) = match &input.source {
        SourceControlDiffSource::WorkingTree => {
            let mut a = args.clone();
            a.push("--numstat".into());
            (a, "working-tree")
        }
        SourceControlDiffSource::Staged => {
            let mut a = args.clone();
            a.push("--staged".into());
            a.push("--numstat".into());
            (a, "staged")
        }
        SourceControlDiffSource::BranchRange { base_ref, head_ref } => {
            let range = match head_ref {
                Some(h) => format!("{}..{}", base_ref, h),
                None => base_ref.clone(),
            };
            let mut a = args.clone();
            a.push(range.into());
            a.push("--numstat".into());
            (a, "branch-range")
        }
        SourceControlDiffSource::Commit { oid } => {
            let range = format!("{}^!", oid);
            let mut a = args.clone();
            a.push(range.into());
            a.push("--numstat".into());
            (a, "commit")
        }
        SourceControlDiffSource::CommitRange { base_oid, head_oid } => {
            let range = format!("{}..{}", base_oid, head_oid);
            let mut a = args.clone();
            a.push(range.into());
            a.push("--numstat".into());
            (a, "commit-range")
        }
    };

    // Restrict the diff to the given path when a pathspec is provided.
    if let Some(pathspec) = &input.pathspec {
        let pathspec = pathspec.as_str();
        numstat_args.push("--".into());
        numstat_args.push(pathspec.into());
    }

    let numstat_spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "diff-numstat",
        args: numstat_args,
        timeout: DIFF_TIMEOUT,
        stdout_limit: numstat_limit,
        stderr_limit: numstat_limit,
        policy: SourceControlExecutionPolicy::ParsedRead,
        cancellation: None,
        child_slot: None,
    };

    let numstat_output = process.run(numstat_spec)?;
    let (mut files, mut additions, mut deletions, mut binary) =
        parse_numstat(&numstat_output.stdout);

    let mut patch_args: Vec<OsString> = vec!["diff".into()];
    if input.ignore_whitespace {
        patch_args.push("-w".into());
    }
    add_source_args(&mut patch_args, &input.source);
    if let Some(pathspec) = &input.pathspec {
        let pathspec = pathspec.as_str();
        patch_args.push("--".into());
        patch_args.push(pathspec.into());
    }

    let patch_spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: source_description,
        args: patch_args,
        timeout: DIFF_TIMEOUT,
        stdout_limit: max_bytes,
        stderr_limit: max_bytes,
        policy: SourceControlExecutionPolicy::ParsedRead,
        cancellation: None,
        child_slot: None,
    };

    let patch_result = process.run(patch_spec);
    let (patch, truncated) = match patch_result {
        Ok(output) => {
            let p = String::from_utf8_lossy(&output.stdout).to_string();
            let t = output.stdout.len() >= max_bytes || output.stderr.len() >= max_bytes;
            (p, t)
        }
        Err(PublicSourceControlError {
            code: crate::source_control::contracts::PublicSourceControlErrorCode::OutputLimit,
            ..
        }) => ("[diff truncated]".to_string(), true),
        Err(e) => return Err(e),
    };

    // `git diff` ignores untracked files by default. When the caller scopes
    // the diff to a single working-tree path that is untracked, the patch is
    // empty and numstat lists nothing. Synthesize a patch so the diff popup
    // shows the new file's content (mirroring how editors present new files).
    let patch = if input.pathspec.as_deref().is_some()
        && matches!(input.source, SourceControlDiffSource::WorkingTree)
        && patch.is_empty()
        && files.is_empty()
    {
        let synthesized = synthesize_untracked_patch(
            process,
            checkout,
            input.pathspec.as_deref().unwrap(),
            max_bytes,
        )?;
        if let Some(syn) = synthesized {
            files = syn.files.clone();
            additions = syn.additions;
            deletions = syn.deletions;
            binary = syn.binary;
            syn.patch
        } else {
            patch
        }
    } else {
        patch
    };

    Ok(SourceControlDiffResult {
        source: input.source,
        patch,
        files,
        additions,
        deletions,
        binary,
        truncated,
    })
}

/// Result of synthesizing a patch for an untracked file.
struct SynthesizedPatch {
    patch: String,
    files: Vec<SourceControlDiffFileSummary>,
    additions: u64,
    deletions: u64,
    binary: bool,
}

/// Synthesizes a unified-diff patch for an untracked file.
///
/// `git diff` ignores untracked files, so when the caller scopes a working-tree
/// diff to a path that is untracked, the normal patch is empty. This reads the
/// file content and emits a synthetic `diff --git` / `new file mode` / `+++` /
/// `+` block so the diff popup can present the new file the way editors do.
///
/// Returns `Ok(None)` when the path is not actually an untracked file (for
/// example, it is tracked or does not exist), in which case the caller should
/// keep whatever `git diff` produced.
fn synthesize_untracked_patch(
    process: &impl SourceControlProcess,
    checkout: &Path,
    pathspec: &str,
    max_bytes: usize,
) -> Result<Option<SynthesizedPatch>, PublicSourceControlError> {
    // Confirm the path is untracked: porcelain prefixes untracked entries with
    // `?? `. A tracked-but-modified file starts with ` M`/`MM`/etc.
    let porcelain_spec = SourceControlCommandSpec::parsed_read(
        checkout.to_path_buf(),
        "status-porcelain",
        ["status", "--porcelain", "--", pathspec],
    );
    let porcelain = process.run(porcelain_spec)?;
    let porcelain_text = String::from_utf8_lossy(&porcelain.stdout);
    let is_untracked = porcelain_text
        .lines()
        .any(|line| line.starts_with("??") && line[2..].trim() == pathspec);
    if !is_untracked {
        return Ok(None);
    }

    let file_path = checkout.join(pathspec);
    let content = match std::fs::read(&file_path) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    // Detect binary content (NUL byte), mirroring git's heuristic.
    let is_binary = content.contains(&0u8);
    if is_binary {
        return Ok(Some(SynthesizedPatch {
            patch: format!(
                "diff --git a/{pathspec} b/{pathspec}\nnew file mode 100644\nindex 0000000..0000000\nBinary files /dev/null and b/{pathspec} differ\n"
            ),
            files: vec![SourceControlDiffFileSummary {
                path: pathspec.to_string(),
                old_path: None,
                additions: None,
                deletions: None,
                binary: true,
            }],
            additions: 0,
            deletions: 0,
            binary: true,
        }));
    }

    let text = String::from_utf8_lossy(&content);
    let mut patch = String::new();
    patch.push_str(&format!("diff --git a/{pathspec} b/{pathspec}\n"));
    patch.push_str("new file mode 100644\n");
    patch.push_str("index 0000000..0000000\n");
    patch.push_str("--- /dev/null\n");
    patch.push_str(&format!("+++ b/{pathspec}\n"));

    let mut additions: u64 = 0;
    let mut truncated = false;
    for line in text.split_inclusive('\n') {
        if patch.len() + line.len() + 1 > max_bytes {
            truncated = true;
            break;
        }
        // A literal line that starts with `+`, `-`, ` ` or `\` must be escaped
        // so the unified diff is unambiguous.
        let body = line.strip_suffix('\n').unwrap_or(line);
        let escaped = match body.chars().next() {
            Some('+' | '-' | ' ' | '\\') => format!("\\{body}"),
            _ => body.to_string(),
        };
        patch.push('+');
        patch.push_str(&escaped);
        patch.push('\n');
        additions += 1;
    }
    if truncated {
        patch.push_str("[diff truncated]\n");
    }

    Ok(Some(SynthesizedPatch {
        patch,
        files: vec![SourceControlDiffFileSummary {
            path: pathspec.to_string(),
            old_path: None,
            additions: Some(additions),
            deletions: Some(0),
            binary: false,
        }],
        additions,
        deletions: 0,
        binary: false,
    }))
}

fn add_source_args(args: &mut Vec<OsString>, source: &SourceControlDiffSource) {
    match source {
        SourceControlDiffSource::WorkingTree => {}
        SourceControlDiffSource::Staged => {
            args.push("--staged".into());
        }
        SourceControlDiffSource::BranchRange { base_ref, head_ref } => {
            let range = match head_ref {
                Some(h) => format!("{}..{}", base_ref, h),
                None => base_ref.clone(),
            };
            args.push(range.into());
        }
        SourceControlDiffSource::Commit { oid } => {
            args.push(format!("{}^!", oid).into());
        }
        SourceControlDiffSource::CommitRange { base_oid, head_oid } => {
            args.push(format!("{}..{}", base_oid, head_oid).into());
        }
    }
}

fn parse_numstat(data: &[u8]) -> (Vec<SourceControlDiffFileSummary>, u64, u64, bool) {
    let text = String::from_utf8_lossy(data);
    let mut files: Vec<SourceControlDiffFileSummary> = Vec::new();
    let mut total_additions: u64 = 0;
    let mut total_deletions: u64 = 0;
    let mut any_binary = false;

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parts: Vec<&str> = trimmed.splitn(3, '\t').collect();
        if parts.len() < 3 {
            continue;
        }
        let add: u64 = parts[0].parse().unwrap_or(0);
        let del: u64 = parts[1].parse().unwrap_or(0);
        let path = parts[2];

        let is_binary = parts[0] == "-" && parts[1] == "-";
        if is_binary {
            any_binary = true;
            files.push(SourceControlDiffFileSummary {
                path: path.to_string(),
                old_path: None,
                additions: None,
                deletions: None,
                binary: true,
            });
        } else {
            total_additions += add;
            total_deletions += del;
            files.push(SourceControlDiffFileSummary {
                path: path.to_string(),
                old_path: None,
                additions: Some(add),
                deletions: Some(del),
                binary: false,
            });
        }
    }

    (files, total_additions, total_deletions, any_binary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    fn init_repo(path: &Path) {
        assert!(Command::new("git")
            .args(["init", "--quiet", "-b", "main"])
            .arg(path)
            .status()
            .unwrap()
            .success());
        assert!(Command::new("git")
            .args([
                "-C",
                path.to_str().unwrap(),
                "config",
                "user.email",
                "test@test.com"
            ])
            .status()
            .unwrap()
            .success());
        assert!(Command::new("git")
            .args(["-C", path.to_str().unwrap(), "config", "user.name", "Test"])
            .status()
            .unwrap()
            .success());
    }
    fn scope(path: &Path) -> SourceControlScopeRecord {
        SourceControlScopeRecord {
            scope_id: "scope-1".into(),
            project_id: "p".into(),
            trunk_id: "t".into(),
            project_root: path.to_path_buf(),
            checkout_path: path.to_path_buf(),
            checkout_identity: format!("checkout:{}", path.display()),
            repository_identity: None,
            managed_by_app: false,
        }
    }

    #[test]
    fn diffs_working_tree_changes() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        fs::write(dir.path().join("a.txt"), "staged").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "a.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "init"])
            .status()
            .unwrap();
        fs::write(dir.path().join("a.txt"), "modified").unwrap();

        let result = get_diff(
            SourceControlDiffInput {
                scope_id: "scope-1".into(),
                source: SourceControlDiffSource::WorkingTree,
                ignore_whitespace: false,
                max_bytes: DEFAULT_MAX_BYTES,
                pathspec: None,
            },
            &scope(dir.path()),
        )
        .unwrap();

        assert!(result.patch.contains("modified"));
        assert!(!result.binary);
        assert!(!result.truncated);
    }

    #[test]
    fn diffs_staged_changes() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        fs::write(dir.path().join("b.txt"), "initial").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "b.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "base"])
            .status()
            .unwrap();
        fs::write(dir.path().join("b.txt"), "modified").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "b.txt"])
            .status()
            .unwrap();

        let result = get_diff(
            SourceControlDiffInput {
                scope_id: "scope-1".into(),
                source: SourceControlDiffSource::Staged,
                ignore_whitespace: false,
                max_bytes: DEFAULT_MAX_BYTES,
                pathspec: None,
            },
            &scope(dir.path()),
        )
        .unwrap();

        assert!(result.patch.contains("modified"));
    }

    #[test]
    fn reports_truncated_for_large_output() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        fs::write(dir.path().join("a.txt"), "base").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "a.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "base"])
            .status()
            .unwrap();
        // Create a large staged file to hit the limit
        let big_content = "line\n".repeat(500);
        fs::write(dir.path().join("big.txt"), &big_content).unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "big.txt"])
            .status()
            .unwrap();

        let result = get_diff(
            SourceControlDiffInput {
                scope_id: "scope-1".into(),
                source: SourceControlDiffSource::Staged,
                ignore_whitespace: false,
                max_bytes: 50,
                pathspec: None,
            },
            &scope(dir.path()),
        )
        .unwrap();

        assert!(result.truncated);
    }

    #[test]
    fn numstat_parses_binary() {
        let (files, _, _, binary) = parse_numstat(b"-\t-\tsomefile.png\n");
        assert!(binary);
        assert_eq!(files.len(), 1);
        assert!(files[0].binary);
    }

    #[test]
    fn numstat_parses_adds_and_dels() {
        let (files, additions, deletions, binary) =
            parse_numstat(b"5\t3\tmain.ts\n2\t0\tsrc/a.ts\n");
        assert!(!binary);
        assert_eq!(additions, 7);
        assert_eq!(deletions, 3);
        assert_eq!(files.len(), 2);
    }

    #[test]
    fn scopes_diff_to_a_single_file_path() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        fs::write(dir.path().join("a.txt"), "base").unwrap();
        fs::write(dir.path().join("b.txt"), "base").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "a.txt", "b.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "base"])
            .status()
            .unwrap();
        // Modify both files.
        fs::write(dir.path().join("a.txt"), "modified-a").unwrap();
        fs::write(dir.path().join("b.txt"), "modified-b").unwrap();

        let result = get_diff(
            SourceControlDiffInput {
                scope_id: "scope-1".into(),
                source: SourceControlDiffSource::WorkingTree,
                ignore_whitespace: false,
                max_bytes: DEFAULT_MAX_BYTES,
                pathspec: Some("a.txt".into()),
            },
            &scope(dir.path()),
        )
        .unwrap();

        // Only a.txt appears in the numstat file list.
        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].path, "a.txt");
        // The patch references only a.txt.
        assert!(result.patch.contains("a.txt"));
        assert!(!result.patch.contains("modified-b"));
    }

    #[test]
    fn synthesizes_diff_for_untracked_file() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        fs::write(dir.path().join("committed.txt"), "base").unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "committed.txt"])
            .status()
            .unwrap();
        Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "commit", "-m", "base"])
            .status()
            .unwrap();
        // Add a new untracked file.
        fs::write(dir.path().join("new.txt"), "hello\nworld\n").unwrap();

        let result = get_diff(
            SourceControlDiffInput {
                scope_id: "scope-1".into(),
                source: SourceControlDiffSource::WorkingTree,
                ignore_whitespace: false,
                max_bytes: DEFAULT_MAX_BYTES,
                pathspec: Some("new.txt".into()),
            },
            &scope(dir.path()),
        )
        .unwrap();

        // Untracked files are invisible to `git diff` by default; the backend
        // must synthesize a patch so the diff popup shows the new content.
        assert!(result.patch.contains("new.txt"));
        assert!(result.patch.contains("+hello"));
        assert!(result.patch.contains("+world"));
        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].path, "new.txt");
        assert_eq!(result.additions, 2);
        assert!(!result.truncated);
    }
}
