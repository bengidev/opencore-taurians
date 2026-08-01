use crate::source_control::contracts::{
    PublicSourceControlError, SourceControlCapabilities, SourceControlHeadSummary,
    SourceControlInitializeInput, SourceControlPanelSectionCounts, SourceControlRepositorySnapshot,
    SourceControlRepositoryStatus,
};
use crate::source_control::parse::parse_porcelain_v2;
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope::detect_repository;
use crate::source_control::scope_registry::SourceControlScopeRecord;
use std::collections::HashMap;
use std::ffi::OsString;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Default)]
pub struct SourceControlRepositoryState {
    revisions: Mutex<HashMap<String, u64>>,
}

impl SourceControlRepositoryState {
    fn next_revision(&self, checkout_identity: &str) -> u64 {
        let mut revisions = self.revisions.lock().unwrap();
        let revision = revisions.entry(checkout_identity.to_string()).or_default();
        *revision += 1;
        *revision
    }
}

pub fn get_snapshot(
    input: crate::source_control::contracts::SourceControlCheckoutRequest,
    state: &SourceControlRepositoryState,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    debug_assert_eq!(input.scope_id, scope.scope_id);
    snapshot_with(&SystemGitProcess, state, scope)
}

pub fn refresh(
    input: crate::source_control::contracts::SourceControlCheckoutRequest,
    state: &SourceControlRepositoryState,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    debug_assert_eq!(input.scope_id, scope.scope_id);
    snapshot_with(&SystemGitProcess, state, scope)
}

pub fn initialize(
    input: SourceControlInitializeInput,
    state: &SourceControlRepositoryState,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    debug_assert_eq!(input.scope_id, scope.scope_id);
    initialize_with(&SystemGitProcess, state, scope)
}

pub fn initialize_with(
    process: &impl SourceControlProcess,
    state: &SourceControlRepositoryState,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    let checkout_path = scope.checkout_path.as_path();
    let spec = SourceControlCommandSpec {
        checkout: checkout_path.to_path_buf(),
        operation: "initialize",
        args: vec![OsString::from("init")],
        timeout: Duration::from_secs(30),
        stdout_limit: 256 * 1024,
        stderr_limit: 256 * 1024,
        policy: SourceControlExecutionPolicy::TrustedMutation,
    };
    process.run(spec)?;
    let detected = detect_repository(process, checkout_path)
        .map_err(|_| PublicSourceControlError::not_repository("initialize"))?;
    let resolved_scope = SourceControlScopeRecord {
        checkout_identity: detected.checkout_identity.clone(),
        checkout_path: detected.checkout_path.clone(),
        repository_identity: Some(detected.repository_identity),
        ..scope.clone()
    };
    snapshot_with(process, state, &resolved_scope)
}

fn discover_git_version(process: &impl SourceControlProcess, checkout: &Path) -> Option<String> {
    process
        .run(SourceControlCommandSpec::parsed_read(
            checkout,
            "discover",
            ["--version"],
        ))
        .ok()
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn snapshot_with(
    process: &impl SourceControlProcess,
    state: &SourceControlRepositoryState,
    scope: &SourceControlScopeRecord,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    let path = scope.checkout_path.as_path();
    let version = discover_git_version(process, path);
    let detected = detect_repository(process, path).ok();
    if let (Some(expected), Some(actual)) = (
        scope.repository_identity.as_deref(),
        detected
            .as_ref()
            .map(|item| item.repository_identity.as_str()),
    ) {
        if expected != actual {
            return Err(PublicSourceControlError::checkout_invalid(
                "snapshot",
                "The repository identity changed after checkout validation.",
            ));
        }
    }

    let revision = state.next_revision(&scope.checkout_identity);
    let captured_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string();
    let worktree_label = path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| scope.checkout_path.to_string_lossy().into_owned());

    let Some(repository) = detected else {
        return Ok(SourceControlRepositorySnapshot {
            scope_id: scope.scope_id.clone(),
            project_id: scope.project_id.clone(),
            trunk_id: scope.trunk_id.clone(),
            checkout_path: scope.checkout_path.to_string_lossy().into_owned(),
            checkout_identity: scope.checkout_identity.clone(),
            repository_identity: None,
            revision,
            captured_at,
            repository_state: if version.is_some() {
                SourceControlRepositoryStatus::NotRepository
            } else {
                SourceControlRepositoryStatus::SourceControlUnavailable
            },
            worktree_label,
            head: None,
            upstream: None,
            default_branch: None,
            ahead: 0,
            behind: 0,
            files: Vec::new(),
            conflict_count: 0,
            operation: None,
            remotes: Vec::new(),
            section_counts: SourceControlPanelSectionCounts::default(),
            capabilities: SourceControlCapabilities {
                git_version: version,
                supports_worktrees: false,
                lfs_available: false,
            },
        });
    };

    let output = process.run(SourceControlCommandSpec::parsed_read(
        path,
        "status",
        ["status", "--porcelain=v2", "--branch", "-z", "--ignored=no"],
    ))?;
    let mut parsed = parse_porcelain_v2(&output.stdout);
    if matches!(
        parsed.head,
        Some(SourceControlHeadSummary::Unborn { name: None })
    ) {
        parsed.head = Some(SourceControlHeadSummary::Unborn {
            name: repository.ref_name.clone(),
        });
    }
    let repository_state = if matches!(parsed.head, Some(SourceControlHeadSummary::Unborn { .. })) {
        SourceControlRepositoryStatus::Unborn
    } else {
        SourceControlRepositoryStatus::Ready
    };
    let changes = parsed
        .files
        .iter()
        .filter(|file| file.worktree_status.is_some())
        .count();
    let staged_changes = parsed
        .files
        .iter()
        .filter(|file| file.index_status.is_some())
        .count();
    let conflict_count = parsed
        .files
        .iter()
        .filter(|file| file.conflict_status.is_some())
        .count();
    Ok(SourceControlRepositorySnapshot {
        scope_id: scope.scope_id.clone(),
        project_id: scope.project_id.clone(),
        trunk_id: scope.trunk_id.clone(),
        checkout_path: repository.checkout_path.to_string_lossy().into_owned(),
        checkout_identity: scope.checkout_identity.clone(),
        repository_identity: Some(repository.repository_identity),
        revision,
        captured_at,
        repository_state,
        worktree_label,
        head: parsed.head,
        upstream: parsed.upstream,
        default_branch: None,
        ahead: parsed.ahead,
        behind: parsed.behind,
        files: parsed.files,
        conflict_count,
        operation: None,
        remotes: Vec::new(),
        section_counts: SourceControlPanelSectionCounts {
            changes,
            staged_changes,
            worktrees: 1,
            ..SourceControlPanelSectionCounts::default()
        },
        capabilities: SourceControlCapabilities {
            git_version: version,
            supports_worktrees: true,
            lfs_available: false,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source_control::contracts::{
        ResolvedSourceControlCheckout, ResolvedSourceControlCheckoutKind,
        SourceControlCheckoutRequest, SourceControlCheckoutRestore,
    };
    use crate::source_control::scope::resolve_checkout;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    fn resolve_root(path: &Path) -> ResolvedSourceControlCheckout {
        let result = resolve_checkout(
            crate::source_control::contracts::SourceControlResolveCheckoutInput {
                project_id: "p".into(),
                trunk_id: "t".into(),
                project_folder_path: path.to_string_lossy().into_owned(),
                git_checkout: SourceControlCheckoutRestore::ProjectRoot {
                    repository_identity: None,
                    saved_ref_name: None,
                },
            },
        );
        let crate::source_control::contracts::SourceControlResolveCheckoutResult::Ready {
            checkout,
        } = result
        else {
            panic!("expected ready")
        };
        checkout
    }
    fn scope_for(
        path: &Path,
        checkout: &ResolvedSourceControlCheckout,
    ) -> SourceControlScopeRecord {
        SourceControlScopeRecord {
            scope_id: checkout.scope_id.clone(),
            project_id: "p".into(),
            trunk_id: "t".into(),
            project_root: path.to_path_buf(),
            checkout_path: path.to_path_buf(),
            checkout_identity: checkout.checkout_identity.clone(),
            repository_identity: checkout.repository_identity.clone(),
            managed_by_app: checkout.managed_by_app,
        }
    }
    #[test]
    fn reports_non_repository_without_failing() {
        let dir = tempdir().unwrap();
        let checkout = resolve_root(dir.path());
        let scope = scope_for(dir.path(), &checkout);
        let snapshot = get_snapshot(
            SourceControlCheckoutRequest {
                scope_id: checkout.scope_id.clone(),
            },
            &SourceControlRepositoryState::default(),
            &scope,
        )
        .unwrap();
        assert_eq!(
            snapshot.repository_state,
            SourceControlRepositoryStatus::NotRepository
        );
        assert_eq!(snapshot.revision, 1);
    }

    #[test]
    fn initializes_and_reports_unborn_repository() {
        let dir = tempdir().unwrap();
        let state = SourceControlRepositoryState::default();
        let checkout = resolve_root(dir.path());
        let scope = scope_for(dir.path(), &checkout);
        let snapshot = initialize(
            SourceControlInitializeInput {
                scope_id: checkout.scope_id.clone(),
            },
            &state,
            &scope,
        )
        .unwrap();
        assert_eq!(
            snapshot.repository_state,
            SourceControlRepositoryStatus::Unborn
        );
        assert!(snapshot.repository_identity.is_some());
    }

    #[test]
    fn classifies_staged_and_untracked_files() {
        let dir = tempdir().unwrap();
        assert!(Command::new("git")
            .args(["init", "--quiet"])
            .arg(dir.path())
            .status()
            .unwrap()
            .success());
        fs::write(dir.path().join("staged.txt"), "staged").unwrap();
        fs::write(dir.path().join("untracked.txt"), "untracked").unwrap();
        assert!(Command::new("git")
            .args(["-C", dir.path().to_str().unwrap(), "add", "staged.txt"])
            .status()
            .unwrap()
            .success());
        let checkout = resolve_root(dir.path());
        assert_eq!(
            checkout.kind,
            ResolvedSourceControlCheckoutKind::ProjectRoot
        );
        let scope = scope_for(dir.path(), &checkout);
        let snapshot = get_snapshot(
            SourceControlCheckoutRequest {
                scope_id: checkout.scope_id.clone(),
            },
            &SourceControlRepositoryState::default(),
            &scope,
        )
        .unwrap();
        assert_eq!(snapshot.section_counts.staged_changes, 1);
        assert_eq!(snapshot.section_counts.changes, 1);
        assert_eq!(snapshot.files.len(), 2);
    }
}
