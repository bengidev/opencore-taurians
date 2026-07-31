use crate::source_control::contracts::{
    SourceControlCheckoutInvalidReason, SourceControlCheckoutRestore, SourceControlResolveCheckoutInput,
    SourceControlResolveCheckoutResult, ResolvedSourceControlCheckout, ResolvedSourceControlCheckoutKind,
};
use crate::source_control::process::{SourceControlCommandSpec, SourceControlProcess, SystemGitProcess};
use crate::path_scope::normalize_path;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepositoryScope {
    pub checkout_path: PathBuf,
    pub checkout_identity: String,
    pub repository_identity: String,
    pub ref_name: Option<String>,
}

pub fn resolve_checkout(input: SourceControlResolveCheckoutInput) -> SourceControlResolveCheckoutResult {
    resolve_checkout_with(&SystemGitProcess, input)
}

pub fn resolve_checkout_with(
    process: &impl SourceControlProcess,
    input: SourceControlResolveCheckoutInput,
) -> SourceControlResolveCheckoutResult {
    let project_path = normalize_path(Path::new(&input.project_folder_path));
    let (kind, checkout_path, expected_identity, saved_ref_name, managed_by_app) =
        match &input.git_checkout {
            SourceControlCheckoutRestore::ProjectRoot {
                repository_identity,
                saved_ref_name,
            } => (
                ResolvedSourceControlCheckoutKind::ProjectRoot,
                project_path.clone(),
                repository_identity.clone(),
                saved_ref_name.clone(),
                false,
            ),
            SourceControlCheckoutRestore::Worktree {
                worktree_path,
                repository_identity,
                saved_ref_name,
                managed_by_app,
            } => {
                let worktree = PathBuf::from(worktree_path);
                if !worktree.exists() {
                    return invalid(
                        SourceControlCheckoutInvalidReason::MissingWorktree,
                        "The saved worktree no longer exists.",
                        Some(worktree_path.clone()),
                        Some(repository_identity.clone()),
                        saved_ref_name.clone(),
                    );
                }
                (
                    ResolvedSourceControlCheckoutKind::Worktree,
                    normalize_path(&worktree),
                    Some(repository_identity.clone()),
                    saved_ref_name.clone(),
                    *managed_by_app,
                )
            }
        };

    let project_scope = detect_repository(process, &project_path).ok();
    let checkout_scope = match detect_repository(process, &checkout_path) {
        Ok(scope) => Some(scope),
        Err(_) if matches!(kind, ResolvedSourceControlCheckoutKind::ProjectRoot) => None,
        Err(_) => {
            return invalid(
                SourceControlCheckoutInvalidReason::RepositoryMismatch,
                "The saved worktree is not a SourceControl checkout.",
                Some(checkout_path.to_string_lossy().into_owned()),
                expected_identity,
                saved_ref_name,
            )
        }
    };

    if let (Some(project), Some(checkout)) = (&project_scope, &checkout_scope) {
        if project.repository_identity != checkout.repository_identity {
            return invalid(
                SourceControlCheckoutInvalidReason::RepositoryMismatch,
                "The saved worktree belongs to a different repository.",
                Some(checkout_path.to_string_lossy().into_owned()),
                expected_identity,
                saved_ref_name,
            );
        }
    }

    if let (Some(expected), Some(actual)) = (
        expected_identity.as_deref(),
        checkout_scope
            .as_ref()
            .map(|scope| scope.repository_identity.as_str()),
    ) {
        if !expected.is_empty() && expected != actual {
            return invalid(
                SourceControlCheckoutInvalidReason::RepositoryIdentityChanged,
                "The repository identity no longer matches the saved trunk.",
                Some(checkout_path.to_string_lossy().into_owned()),
                Some(expected.to_string()),
                saved_ref_name,
            );
        }
    }

    let repository_identity = checkout_scope
        .as_ref()
        .map(|scope| scope.repository_identity.clone());
    let resolved_ref = checkout_scope
        .as_ref()
        .and_then(|scope| scope.ref_name.clone())
        .or(saved_ref_name);
    let normalized_restore = match kind {
        ResolvedSourceControlCheckoutKind::ProjectRoot => SourceControlCheckoutRestore::ProjectRoot {
            repository_identity: repository_identity.clone(),
            saved_ref_name: resolved_ref.clone(),
        },
        ResolvedSourceControlCheckoutKind::Worktree => SourceControlCheckoutRestore::Worktree {
            worktree_path: checkout_path.to_string_lossy().into_owned(),
            repository_identity: repository_identity.clone().unwrap_or_default(),
            saved_ref_name: resolved_ref.clone(),
            managed_by_app,
        },
    };

    SourceControlResolveCheckoutResult::Ready {
        checkout: ResolvedSourceControlCheckout {
            kind,
            checkout_path: checkout_path.to_string_lossy().into_owned(),
            checkout_identity: checkout_identity(&checkout_path),
            repository_identity,
            saved_ref_name: resolved_ref,
            managed_by_app,
            normalized_restore,
        },
    }
}

pub fn detect_repository(
    process: &impl SourceControlProcess,
    checkout: &Path,
) -> Result<RepositoryScope, ()> {
    let root = run_line(
        process,
        checkout,
        "detect-root",
        ["rev-parse", "--show-toplevel"],
    )?;
    let common_dir = run_line(
        process,
        checkout,
        "detect-common-dir",
        ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    )?;
    let ref_name = run_line(
        process,
        checkout,
        "detect-ref",
        ["symbolic-ref", "--quiet", "--short", "HEAD"],
    )
    .ok();
    let checkout_path = normalize_path(Path::new(&root));
    let repository_path = normalize_path(Path::new(&common_dir));
    Ok(RepositoryScope {
        checkout_identity: checkout_identity(&checkout_path),
        checkout_path,
        repository_identity: repository_identity(&repository_path),
        ref_name,
    })
}

fn run_line<const N: usize>(
    process: &impl SourceControlProcess,
    checkout: &Path,
    operation: &'static str,
    args: [&str; N],
) -> Result<String, ()> {
    let output = process
        .run(SourceControlCommandSpec::parsed_read(checkout, operation, args))
        .map_err(|_| ())?;
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        Err(())
    } else {
        Ok(value)
    }
}

fn checkout_identity(path: &Path) -> String {
    format!("checkout:{}", path.to_string_lossy())
}

fn repository_identity(path: &Path) -> String {
    format!("repository:{}", path.to_string_lossy())
}

fn invalid(
    reason: SourceControlCheckoutInvalidReason,
    message: &str,
    worktree_path: Option<String>,
    repository_identity: Option<String>,
    saved_ref_name: Option<String>,
) -> SourceControlResolveCheckoutResult {
    SourceControlResolveCheckoutResult::Invalid {
        reason,
        message: message.to_string(),
        worktree_path,
        repository_identity,
        saved_ref_name,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    fn init(path: &Path) {
        assert!(Command::new("git")
            .args(["init", "--quiet"])
            .arg(path)
            .status()
            .unwrap()
            .success());
    }

    #[test]
    fn resolves_non_repository_project_root_without_inventing_identity() {
        let root = tempdir().unwrap();
        let result = resolve_checkout(SourceControlResolveCheckoutInput {
            project_id: "p".into(),
            trunk_id: "t".into(),
            project_folder_path: root.path().to_string_lossy().into_owned(),
            git_checkout: SourceControlCheckoutRestore::ProjectRoot {
                repository_identity: None,
                saved_ref_name: None,
            },
        });
        let SourceControlResolveCheckoutResult::Ready { checkout } = result else {
            panic!("expected ready")
        };
        assert_eq!(checkout.repository_identity, None);
        assert_eq!(checkout.kind, ResolvedSourceControlCheckoutKind::ProjectRoot);
    }

    #[test]
    fn rejects_worktree_from_different_repository() {
        let project = tempdir().unwrap();
        let other = tempdir().unwrap();
        init(project.path());
        init(other.path());
        let result = resolve_checkout(SourceControlResolveCheckoutInput {
            project_id: "p".into(),
            trunk_id: "t".into(),
            project_folder_path: project.path().to_string_lossy().into_owned(),
            git_checkout: SourceControlCheckoutRestore::Worktree {
                worktree_path: other.path().to_string_lossy().into_owned(),
                repository_identity: String::new(),
                saved_ref_name: None,
                managed_by_app: false,
            },
        });
        assert!(matches!(
            result,
            SourceControlResolveCheckoutResult::Invalid {
                reason: SourceControlCheckoutInvalidReason::RepositoryMismatch,
                ..
            }
        ));
    }

    #[test]
    fn rejects_missing_worktree_without_fallback() {
        let project = tempdir().unwrap();
        init(project.path());
        let missing = project.path().join("missing");
        let result = resolve_checkout(SourceControlResolveCheckoutInput {
            project_id: "p".into(),
            trunk_id: "t".into(),
            project_folder_path: project.path().to_string_lossy().into_owned(),
            git_checkout: SourceControlCheckoutRestore::Worktree {
                worktree_path: missing.to_string_lossy().into_owned(),
                repository_identity: "repository:expected".into(),
                saved_ref_name: Some("main".into()),
                managed_by_app: true,
            },
        });
        assert!(matches!(
            result,
            SourceControlResolveCheckoutResult::Invalid {
                reason: SourceControlCheckoutInvalidReason::MissingWorktree,
                ..
            }
        ));
        assert!(!missing.exists());
        assert!(fs::metadata(project.path()).is_ok());
    }
}
