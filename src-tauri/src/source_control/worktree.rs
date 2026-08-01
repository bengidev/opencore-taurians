use crate::path_scope::normalize_path;
use crate::source_control::contracts::{
    PublicSourceControlError, ResolvedSourceControlCheckout, ResolvedSourceControlCheckoutKind,
    SourceControlCheckoutRestore,
};
use crate::source_control::coordinator::{
    SourceControlOperationContext, SourceControlOperationCoordinatorState,
};
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope::{detect_repository, RepositoryScope};
use crate::source_control::scope_registry::{SourceControlScopeRecord, SourceControlScopeRegistry};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCreateWorktreeInput {
    pub project_id: String,
    pub parent_trunk_id: String,
    pub parent_scope_id: String,
    pub trunk_id: String,
    pub project_folder_path: String,
    pub base_ref_name: String,
    pub branch_name: String,
    pub history_mode: SourceControlWorktreeHistoryMode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlWorktreeHistoryMode {
    Normal,
    Orphan,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlAttachWorktreeInput {
    pub project_id: String,
    pub parent_trunk_id: String,
    pub trunk_id: String,
    pub project_folder_path: String,
    pub worktree_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceControlRepairWorktreeInput {
    Reattach {
        project_id: String,
        trunk_id: String,
        project_folder_path: String,
        expected_repository_identity: String,
        worktree_path: String,
    },
    Recreate {
        project_id: String,
        trunk_id: String,
        project_folder_path: String,
        expected_repository_identity: String,
        ref_name: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlWorktreeMutationResult {
    pub checkout: ResolvedSourceControlCheckout,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlWorktreeRemovalInspection {
    pub worktree_path: String,
    pub repository_identity: String,
    pub managed_by_app: bool,
    pub dirty: bool,
    pub has_unmerged_changes: bool,
    pub has_unmerged_commits: bool,
    pub head_oid: Option<String>,
    pub affected_trunk_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRemoveWorktreeInput {
    pub scope_id: Option<String>,
    pub worktree_path: String,
    pub repository_identity: String,
    pub expected_head_oid: Option<String>,
    pub allow_dirty: bool,
    pub allow_unmerged_changes: bool,
    pub allow_unmerged_commits: bool,
}

// Scaffolding for the worktree-list track; not yet wired into lib.rs.
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlWorktreeSummary {
    pub path: String,
    pub branch: Option<String>,
    pub oid: String,
    pub bare: bool,
    pub locked: bool,
    pub locked_reason: Option<String>,
    pub prunable: bool,
    pub is_current: bool,
}

const WORKTREE_TIMEOUT: Duration = Duration::from_secs(30);
const OUTPUT_LIMIT: usize = 256 * 1024;

fn run_worktree_command(
    process: &impl SourceControlProcess,
    checkout: &Path,
    operation: &'static str,
    args: &[&str],
    op_ctx: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<Vec<u8>, PublicSourceControlError> {
    let mut spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation,
        args: args.iter().map(OsString::from).collect(),
        timeout: WORKTREE_TIMEOUT,
        stdout_limit: OUTPUT_LIMIT,
        stderr_limit: OUTPUT_LIMIT,
        policy: SourceControlExecutionPolicy::TrustedMutation,
        cancellation: None,
        child_slot: None,
    };
    if let Some((ctx, coordinator)) = op_ctx {
        if let Some(slot) = coordinator.child_slot(&ctx.operation_id) {
            spec = spec.attach_operation(ctx.cancellation.clone(), slot);
        }
    }
    let output = process.run(spec)?;
    Ok(output.stdout)
}

fn run_line(
    process: &impl SourceControlProcess,
    checkout: &Path,
    operation: &'static str,
    args: &[&str],
    op_ctx: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<String, PublicSourceControlError> {
    let stdout = run_worktree_command(process, checkout, operation, args, op_ctx)?;
    Ok(String::from_utf8_lossy(&stdout).trim().to_string())
}

fn app_data_worktree_root() -> PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("opencore-taurians")
        .join("worktrees")
}

fn canonical_managed_worktree_root() -> PathBuf {
    static ROOT: OnceLock<PathBuf> = OnceLock::new();
    ROOT.get_or_init(|| {
        let root = app_data_worktree_root();
        let _ = std::fs::create_dir_all(&root);
        std::fs::canonicalize(&root).unwrap_or(root)
    })
    .clone()
}

pub fn is_managed_worktree_path(path: &Path) -> bool {
    let Ok(canonical) = std::fs::canonicalize(path) else {
        return false;
    };
    let root = canonical_managed_worktree_root();
    canonical.starts_with(&root)
}

fn validate_repository_identity_exact(
    operation: &'static str,
    expected: &str,
    actual: &str,
) -> Result<(), PublicSourceControlError> {
    if expected.is_empty() {
        return Err(PublicSourceControlError::checkout_invalid(
            operation,
            "The repository identity must not be empty.",
        ));
    }
    if actual.is_empty() {
        return Err(PublicSourceControlError::checkout_invalid(
            operation,
            "The checkout repository identity is missing.",
        ));
    }
    if expected != actual {
        return Err(PublicSourceControlError::checkout_invalid(
            operation,
            "The repository identity does not match.",
        ));
    }
    Ok(())
}

fn register_worktree_checkout(
    registry: &SourceControlScopeRegistry,
    project_id: &str,
    trunk_id: &str,
    project_folder_path: &Path,
    scope: &RepositoryScope,
    saved_ref_name: Option<String>,
    managed_by_app: bool,
) -> ResolvedSourceControlCheckout {
    let normalized_restore = SourceControlCheckoutRestore::Worktree {
        worktree_path: scope.checkout_path.to_string_lossy().into_owned(),
        repository_identity: scope.repository_identity.clone(),
        saved_ref_name: saved_ref_name.clone(),
        managed_by_app,
    };
    let scope_id = registry.register(SourceControlScopeRecord {
        scope_id: String::new(),
        project_id: project_id.to_string(),
        trunk_id: trunk_id.to_string(),
        project_root: project_folder_path.to_path_buf(),
        checkout_path: scope.checkout_path.clone(),
        checkout_identity: scope.checkout_identity.clone(),
        repository_identity: Some(scope.repository_identity.clone()),
        managed_by_app,
    });
    ResolvedSourceControlCheckout {
        scope_id,
        kind: ResolvedSourceControlCheckoutKind::Worktree,
        checkout_path: scope.checkout_path.to_string_lossy().into_owned(),
        checkout_identity: scope.checkout_identity.clone(),
        repository_identity: Some(scope.repository_identity.clone()),
        saved_ref_name,
        managed_by_app,
        normalized_restore,
    }
}

pub fn create_worktree_with(
    process: &impl SourceControlProcess,
    input: SourceControlCreateWorktreeInput,
    registry: &SourceControlScopeRegistry,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    let parent = registry.resolve(&input.parent_scope_id, "create-worktree")?;

    if parent.project_id != input.project_id {
        return Err(PublicSourceControlError::checkout_invalid(
            "create-worktree",
            "The parent scope belongs to a different project.",
        ));
    }

    if parent.trunk_id != input.parent_trunk_id {
        return Err(PublicSourceControlError::checkout_invalid(
            "create-worktree",
            "The parent scope does not match the parent trunk.",
        ));
    }

    let project_path = normalize_path(Path::new(&input.project_folder_path));
    if normalize_path(&parent.project_root) != project_path {
        return Err(PublicSourceControlError::checkout_invalid(
            "create-worktree",
            "The project folder path does not match the parent scope.",
        ));
    }

    let scope = detect_repository(process, &parent.checkout_path)
        .map_err(|_| PublicSourceControlError::not_repository("create-worktree"))?;

    if let Some(expected) = parent.repository_identity.as_deref() {
        validate_repository_identity_exact(
            "create-worktree",
            expected,
            &scope.repository_identity,
        )?;
    }

    let worktree_root = app_data_worktree_root();
    std::fs::create_dir_all(&worktree_root)
        .map_err(|_| PublicSourceControlError::process_failed("create-worktree", true))?;

    let safe_name = sanitize_worktree_dir_name(&input.trunk_id);
    let worktree_path = worktree_root.join(&safe_name);

    if worktree_path.exists() {
        return Err(PublicSourceControlError::precondition_failed(
            "create-worktree",
            "A worktree already exists at the target path.",
        ));
    }

    let mut args: Vec<String> = vec!["worktree".into(), "add".into()];
    match &input.history_mode {
        SourceControlWorktreeHistoryMode::Orphan => {
            args.push("--orphan".into());
            args.push("-b".into());
            args.push(input.branch_name.clone());
            args.push(worktree_path.to_string_lossy().into_owned());
        }
        SourceControlWorktreeHistoryMode::Normal => {
            args.push("--checkout".into());
            args.push("-b".into());
            args.push(input.branch_name.clone());
            args.push(worktree_path.to_string_lossy().into_owned());
            args.push(input.base_ref_name.clone());
        }
    }
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_worktree_command(
        process,
        &scope.checkout_path,
        "create-worktree",
        &str_args,
        operation,
    )?;

    let new_scope = detect_repository(process, &worktree_path)
        .map_err(|_| PublicSourceControlError::process_failed("create-worktree", false))?;

    let checkout = register_worktree_checkout(
        registry,
        &input.project_id,
        &input.trunk_id,
        &project_path,
        &new_scope,
        Some(input.branch_name.clone()),
        true,
    );

    Ok(SourceControlWorktreeMutationResult { checkout })
}

pub fn attach_worktree_with(
    process: &impl SourceControlProcess,
    input: SourceControlAttachWorktreeInput,
    registry: &SourceControlScopeRegistry,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    let project_path = Path::new(&input.project_folder_path);
    let project_scope = detect_repository(process, project_path)
        .map_err(|_| PublicSourceControlError::not_repository("attach-worktree"))?;

    let worktree_path = Path::new(&input.worktree_path);
    if !worktree_path.exists() {
        return Err(PublicSourceControlError::checkout_invalid(
            "attach-worktree",
            "The worktree path does not exist.",
        ));
    }

    let attached_scope = detect_repository(process, worktree_path).map_err(|_| {
        PublicSourceControlError::checkout_invalid(
            "attach-worktree",
            "The path is not a valid SourceControl checkout.",
        )
    })?;

    if project_scope.repository_identity != attached_scope.repository_identity {
        return Err(PublicSourceControlError::checkout_invalid(
            "attach-worktree",
            "The worktree belongs to a different repository.",
        ));
    }

    let managed_by_app = is_managed_worktree_path(worktree_path);
    let checkout = register_worktree_checkout(
        registry,
        &input.project_id,
        &input.trunk_id,
        project_path,
        &attached_scope,
        attached_scope.ref_name.clone(),
        managed_by_app,
    );

    Ok(SourceControlWorktreeMutationResult { checkout })
}

pub fn repair_worktree_with(
    process: &impl SourceControlProcess,
    input: SourceControlRepairWorktreeInput,
    registry: &SourceControlScopeRegistry,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    match &input {
        SourceControlRepairWorktreeInput::Reattach {
            project_id,
            trunk_id,
            project_folder_path,
            expected_repository_identity,
            worktree_path,
        } => {
            let project_path = Path::new(project_folder_path);
            let project_scope = detect_repository(process, project_path)
                .map_err(|_| PublicSourceControlError::not_repository("repair-worktree"))?;

            if &project_scope.repository_identity != expected_repository_identity {
                return Err(PublicSourceControlError::checkout_invalid(
                    "repair-worktree",
                    "The repository identity no longer matches.",
                ));
            }

            let wt_path = Path::new(worktree_path);

            run_worktree_command(
                process,
                &project_scope.checkout_path,
                "repair-worktree",
                &["worktree", "repair", worktree_path],
                operation,
            )?;

            let repaired_scope = detect_repository(process, wt_path).map_err(|_| {
                PublicSourceControlError::checkout_invalid(
                    "repair-worktree",
                    "Worktree repair failed — the path is not a valid checkout.",
                )
            })?;

            let managed_by_app = is_managed_worktree_path(wt_path);
            let checkout = register_worktree_checkout(
                registry,
                project_id,
                trunk_id,
                project_path,
                &repaired_scope,
                repaired_scope.ref_name.clone(),
                managed_by_app,
            );

            Ok(SourceControlWorktreeMutationResult { checkout })
        }
        SourceControlRepairWorktreeInput::Recreate {
            project_id,
            trunk_id,
            project_folder_path,
            expected_repository_identity,
            ref_name,
        } => {
            let project_path = Path::new(project_folder_path);
            let project_scope = detect_repository(process, project_path)
                .map_err(|_| PublicSourceControlError::not_repository("repair-worktree"))?;

            if &project_scope.repository_identity != expected_repository_identity {
                return Err(PublicSourceControlError::checkout_invalid(
                    "repair-worktree",
                    "The repository identity no longer matches.",
                ));
            }

            let worktree_root = app_data_worktree_root();
            let safe_id = format!("recreate-{}", uuid::Uuid::new_v4());
            let worktree_path = worktree_root.join(&safe_id);

            std::fs::create_dir_all(worktree_root)
                .map_err(|_| PublicSourceControlError::process_failed("repair-worktree", true))?;

            let wt_str = worktree_path.to_string_lossy();
            run_worktree_command(
                process,
                &project_scope.checkout_path,
                "repair-worktree",
                &["worktree", "add", "--checkout", &wt_str, ref_name],
                operation,
            )?;

            let new_scope = detect_repository(process, &worktree_path)
                .map_err(|_| PublicSourceControlError::process_failed("repair-worktree", false))?;

            let checkout = register_worktree_checkout(
                registry,
                project_id,
                trunk_id,
                project_path,
                &new_scope,
                Some(ref_name.clone()),
                true,
            );

            Ok(SourceControlWorktreeMutationResult { checkout })
        }
    }
}

pub fn inspect_worktree_removal(
    input: InspectWorktreeRemovalInput,
) -> Result<SourceControlWorktreeRemovalInspection, PublicSourceControlError> {
    inspect_worktree_removal_with(&SystemGitProcess, input)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectWorktreeRemovalInput {
    pub worktree_path: String,
    pub repository_identity: String,
    #[serde(default)]
    pub affected_trunk_ids: Vec<String>,
}

pub fn inspect_worktree_removal_with(
    process: &impl SourceControlProcess,
    input: InspectWorktreeRemovalInput,
) -> Result<SourceControlWorktreeRemovalInspection, PublicSourceControlError> {
    let wt_path = Path::new(&input.worktree_path);
    let scope = detect_repository(process, wt_path).map_err(|_| {
        PublicSourceControlError::checkout_invalid(
            "inspect-removal",
            "The worktree path is not a valid SourceControl checkout.",
        )
    })?;

    validate_repository_identity_exact(
        "inspect-removal",
        &input.repository_identity,
        &scope.repository_identity,
    )?;

    let head_oid = run_line(
        process,
        wt_path,
        "inspect-removal",
        &["rev-parse", "HEAD"],
        None,
    )
    .ok();

    let dirty = !run_line(
        process,
        wt_path,
        "inspect-removal",
        &["status", "--porcelain"],
        None,
    )
    .map(|s| s.is_empty())
    .unwrap_or(false);

    let has_unmerged_changes = check_unmerged(process, wt_path);
    let has_unmerged_commits = check_unmerged_commits(process, wt_path);

    let managed_by_app = is_managed_worktree_path(wt_path);

    Ok(SourceControlWorktreeRemovalInspection {
        worktree_path: input.worktree_path,
        repository_identity: scope.repository_identity,
        managed_by_app,
        dirty,
        has_unmerged_changes,
        has_unmerged_commits,
        head_oid,
        affected_trunk_ids: input.affected_trunk_ids,
    })
}

pub fn remove_worktree_with(
    process: &impl SourceControlProcess,
    input: SourceControlRemoveWorktreeInput,
    registry: &SourceControlScopeRegistry,
    operation: Option<(
        &SourceControlOperationContext,
        &SourceControlOperationCoordinatorState,
    )>,
) -> Result<(), PublicSourceControlError> {
    let wt_path = Path::new(&input.worktree_path);

    let scope = detect_repository(process, wt_path).map_err(|_| {
        PublicSourceControlError::checkout_invalid(
            "remove-worktree",
            "The worktree path is not a valid SourceControl checkout.",
        )
    })?;

    validate_repository_identity_exact(
        "remove-worktree",
        &input.repository_identity,
        &scope.repository_identity,
    )?;

    if let Some(expected_oid) = &input.expected_head_oid {
        let current_oid = run_line(
            process,
            wt_path,
            "remove-worktree",
            &["rev-parse", "HEAD"],
            operation,
        )?;
        if &current_oid != expected_oid {
            return Err(PublicSourceControlError::precondition_failed(
                "remove-worktree",
                "The worktree HEAD changed since inspection — refresh and try again.",
            ));
        }
    }

    if !input.allow_dirty {
        let status_out = run_worktree_command(
            process,
            wt_path,
            "remove-worktree",
            &["status", "--porcelain"],
            operation,
        );
        let is_clean = status_out.map(|o| o.is_empty()).unwrap_or(false);
        if !is_clean {
            return Err(PublicSourceControlError::precondition_failed(
                "remove-worktree",
                "The worktree has uncommitted changes.",
            ));
        }
    }

    if !input.allow_unmerged_changes && check_unmerged(process, wt_path) {
        return Err(PublicSourceControlError::precondition_failed(
            "remove-worktree",
            "The worktree has unmerged changes.",
        ));
    }

    let main_checkout = find_main_checkout(process, &scope)
        .ok_or_else(|| PublicSourceControlError::process_failed("remove-worktree", false))?;

    let force_flag = if input.allow_dirty || input.allow_unmerged_changes {
        vec!["--force"]
    } else {
        vec![]
    };

    let mut args = vec!["worktree", "remove"];
    args.extend(force_flag.iter().copied());
    let worktree_str = input.worktree_path.clone();
    args.push(&worktree_str);

    run_worktree_command(process, &main_checkout, "remove-worktree", &args, operation)?;

    if is_managed_worktree_path(wt_path) {
        let _ = std::fs::remove_dir_all(wt_path);
    }

    if let Some(scope_id) = input.scope_id {
        registry.invalidate(&scope_id);
    }

    Ok(())
}

// Scaffolding for the worktree-list track; not yet wired into lib.rs.
#[allow(dead_code)]
pub fn list_worktrees(
    checkout_path: String,
    repository_identity: String,
) -> Result<Vec<SourceControlWorktreeSummary>, PublicSourceControlError> {
    list_worktrees_with(&SystemGitProcess, checkout_path, repository_identity)
}

// Scaffolding for the worktree-list track; not yet wired into lib.rs.
#[allow(dead_code)]
pub fn list_worktrees_with(
    process: &impl SourceControlProcess,
    checkout_path: String,
    repository_identity: String,
) -> Result<Vec<SourceControlWorktreeSummary>, PublicSourceControlError> {
    let path = Path::new(&checkout_path);
    let scope = detect_repository(process, path)
        .map_err(|_| PublicSourceControlError::not_repository("list-worktrees"))?;

    if scope.repository_identity != repository_identity {
        return Err(PublicSourceControlError::checkout_invalid(
            "list-worktrees",
            "The repository identity does not match.",
        ));
    }

    let stdout = run_worktree_command(
        process,
        &scope.checkout_path,
        "list-worktrees",
        &["worktree", "list", "--porcelain"],
        None,
    )?;

    Ok(parse_worktree_list(&stdout))
}

// Scaffolding for the worktree-list track; not yet wired into lib.rs.
#[allow(dead_code)]
fn parse_worktree_list(data: &[u8]) -> Vec<SourceControlWorktreeSummary> {
    let text = String::from_utf8_lossy(data);
    let mut entries: Vec<SourceControlWorktreeSummary> = Vec::new();
    let mut current: Option<WorktreeBuilder> = None;

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if let Some(builder) = current.take() {
                if let Some(summary) = builder.build() {
                    entries.push(summary);
                }
            }
            continue;
        }

        let builder = current.get_or_insert_with(WorktreeBuilder::default);

        if let Some(value) = trimmed.strip_prefix("worktree ") {
            builder.path = Some(value.to_string());
        } else if let Some(value) = trimmed.strip_prefix("HEAD ") {
            builder.oid = Some(value.to_string());
        } else if let Some(value) = trimmed.strip_prefix("branch ") {
            let branch = value.strip_prefix("refs/heads/").unwrap_or(value);
            builder.branch = Some(branch.to_string());
        } else if trimmed == "bare" {
            builder.bare = true;
        } else if trimmed == "locked" {
            builder.locked = true;
        } else if let Some(value) = trimmed.strip_prefix("locked ") {
            builder.locked = true;
            builder.locked_reason = Some(value.to_string());
        } else if trimmed == "prunable" {
            builder.prunable = true;
        }
    }

    if let Some(builder) = current {
        if let Some(summary) = builder.build() {
            entries.push(summary);
        }
    }

    if entries.is_empty() {
        return Vec::new();
    }

    let current_path: Option<String> = entries.first().map(|e| e.path.clone());
    for entry in &mut entries {
        entry.is_current = Some(entry.path.clone()) == current_path;
    }

    entries
}

// Scaffolding for the worktree-list track; not yet wired into lib.rs.
#[allow(dead_code)]
#[derive(Default)]
struct WorktreeBuilder {
    path: Option<String>,
    oid: Option<String>,
    branch: Option<String>,
    bare: bool,
    locked: bool,
    locked_reason: Option<String>,
    prunable: bool,
}

// Scaffolding for the worktree-list track; not yet wired into lib.rs.
#[allow(dead_code)]
impl WorktreeBuilder {
    fn build(self) -> Option<SourceControlWorktreeSummary> {
        Some(SourceControlWorktreeSummary {
            path: self.path?,
            branch: self.branch,
            oid: self.oid.unwrap_or_default(),
            bare: self.bare,
            locked: self.locked,
            locked_reason: self.locked_reason,
            prunable: self.prunable,
            is_current: false,
        })
    }
}

fn find_main_checkout(
    process: &impl SourceControlProcess,
    scope: &RepositoryScope,
) -> Option<PathBuf> {
    let spec = SourceControlCommandSpec {
        checkout: scope.checkout_path.clone(),
        operation: "find-main",
        args: vec![
            OsString::from("worktree"),
            OsString::from("list"),
            OsString::from("--porcelain"),
        ],
        timeout: WORKTREE_TIMEOUT,
        stdout_limit: OUTPUT_LIMIT,
        stderr_limit: OUTPUT_LIMIT,
        policy: SourceControlExecutionPolicy::ParsedRead,
        cancellation: None,
        child_slot: None,
    };
    let stdout = process.run(spec).ok().map(|o| o.stdout)?;
    let text = String::from_utf8_lossy(&stdout);
    let main_path = text
        .lines()
        .filter(|line| line.starts_with("worktree "))
        .map(|line| line.strip_prefix("worktree ").unwrap_or("").to_string())
        .find(|path| !path.contains(".bare") && !path.contains("worktrees"))
        .unwrap_or_else(|| scope.checkout_path.to_string_lossy().into_owned());

    let path = PathBuf::from(&main_path);
    if path.exists() {
        Some(path)
    } else {
        Some(scope.checkout_path.clone())
    }
}

fn check_unmerged(process: &impl SourceControlProcess, checkout: &Path) -> bool {
    let spec = SourceControlCommandSpec {
        checkout: checkout.to_path_buf(),
        operation: "check-unmerged",
        args: vec![OsString::from("ls-files"), OsString::from("--unmerged")],
        timeout: WORKTREE_TIMEOUT,
        stdout_limit: OUTPUT_LIMIT,
        stderr_limit: OUTPUT_LIMIT,
        policy: SourceControlExecutionPolicy::ParsedRead,
        cancellation: None,
        child_slot: None,
    };
    process
        .run(spec)
        .map(|out| !out.stdout.is_empty())
        .unwrap_or(false)
}

fn check_unmerged_commits(process: &impl SourceControlProcess, checkout: &Path) -> bool {
    run_line(
        process,
        checkout,
        "check-unmerged-commits",
        &["rev-list", "--left-only", "--count", "HEAD...@{upstream}"],
        None,
    )
    .map(|out| out.parse::<u64>().map(|count| count > 0).unwrap_or(false))
    .unwrap_or(false)
}

fn sanitize_worktree_dir_name(trunk_id: &str) -> String {
    let base: String = trunk_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .take(32)
        .collect();
    format!("{}-{}", base, &uuid::Uuid::new_v4().to_string()[..8])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source_control::process::SourceControlProcess;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    #[allow(dead_code)]
    struct TestProcess {
        git_cmd: fn(&[&str]) -> String,
    }

    impl SourceControlProcess for TestProcess {
        fn run(
            &self,
            spec: SourceControlCommandSpec,
        ) -> Result<
            crate::source_control::process::SourceControlProcessOutput,
            PublicSourceControlError,
        > {
            let args_str: Vec<&str> = spec.args.iter().map(|s| s.to_str().unwrap_or("")).collect();
            let result = (self.git_cmd)(&args_str);
            Ok(crate::source_control::process::SourceControlProcessOutput {
                status: std::process::ExitStatus::default(),
                stdout: result.into_bytes(),
                stderr: Vec::new(),
            })
        }
    }

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

    fn commit(path: &Path, file: &str) {
        fs::write(path.join(file), "content").unwrap();
        assert!(Command::new("git")
            .args(["-C", path.to_str().unwrap(), "add", file])
            .status()
            .unwrap()
            .success());
        assert!(Command::new("git")
            .args(["-C", path.to_str().unwrap(), "commit", "-m", "test"])
            .status()
            .unwrap()
            .success());
    }

    fn register_parent_scope(
        registry: &SourceControlScopeRegistry,
        repo_path: &Path,
        project_id: &str,
        parent_trunk_id: &str,
    ) -> String {
        let scope = detect_repository(&SystemGitProcess, repo_path).unwrap();
        registry.register(SourceControlScopeRecord {
            scope_id: String::new(),
            project_id: project_id.into(),
            trunk_id: parent_trunk_id.into(),
            project_root: normalize_path(repo_path),
            checkout_path: scope.checkout_path.clone(),
            checkout_identity: scope.checkout_identity.clone(),
            repository_identity: Some(scope.repository_identity.clone()),
            managed_by_app: false,
        })
    }

    fn create_input(
        project_id: &str,
        parent_trunk_id: &str,
        parent_scope_id: &str,
        trunk_id: &str,
        project_folder_path: &str,
        branch_name: &str,
        history_mode: SourceControlWorktreeHistoryMode,
    ) -> SourceControlCreateWorktreeInput {
        SourceControlCreateWorktreeInput {
            project_id: project_id.into(),
            parent_trunk_id: parent_trunk_id.into(),
            parent_scope_id: parent_scope_id.into(),
            trunk_id: trunk_id.into(),
            project_folder_path: project_folder_path.into(),
            base_ref_name: "main".into(),
            branch_name: branch_name.into(),
            history_mode,
        }
    }

    fn create_worktree_for_test(
        registry: &SourceControlScopeRegistry,
        repo_path: &Path,
        project_id: &str,
        parent_trunk_id: &str,
        trunk_id: &str,
        branch_name: &str,
        history_mode: SourceControlWorktreeHistoryMode,
    ) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
        let parent_scope_id =
            register_parent_scope(registry, repo_path, project_id, parent_trunk_id);
        create_worktree_with(
            &SystemGitProcess,
            create_input(
                project_id,
                parent_trunk_id,
                &parent_scope_id,
                trunk_id,
                &repo_path.to_string_lossy(),
                branch_name,
                history_mode,
            ),
            registry,
            None,
        )
    }

    #[test]
    fn creates_worktree_on_app_data_path() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let trunk_id = uuid::Uuid::new_v4().to_string();
        let registry = SourceControlScopeRegistry::default();
        let result = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            &trunk_id,
            "feature/child",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        assert!(result.checkout.checkout_path.contains("opencore-taurians"));
        assert!(result.checkout.checkout_path.contains("worktrees"));
        assert!(result.checkout.saved_ref_name == Some("feature/child".into()));
        assert!(Path::new(&result.checkout.checkout_path).exists());
        assert!(!result.checkout.scope_id.is_empty());

        let _ = std::fs::remove_dir_all(&result.checkout.checkout_path);
    }

    #[test]
    fn creates_orphan_worktree() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let trunk_id = uuid::Uuid::new_v4().to_string();
        let registry = SourceControlScopeRegistry::default();
        let result = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            &trunk_id,
            "orphan-branch",
            SourceControlWorktreeHistoryMode::Orphan,
        )
        .unwrap();

        assert!(Path::new(&result.checkout.checkout_path).exists());
        let _ = std::fs::remove_dir_all(&result.checkout.checkout_path);
    }

    #[test]
    fn rejects_create_with_unknown_parent_scope() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let err = create_worktree_with(
            &SystemGitProcess,
            create_input(
                "p",
                "pt",
                "missing-scope",
                "ct",
                &dir.path().to_string_lossy(),
                "feature/child",
                SourceControlWorktreeHistoryMode::Normal,
            ),
            &registry,
            None,
        )
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );
    }

    #[test]
    fn rejects_create_with_stale_parent_scope() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let parent_scope_id = register_parent_scope(&registry, dir.path(), "p", "pt");
        registry.invalidate(&parent_scope_id);

        let err = create_worktree_with(
            &SystemGitProcess,
            create_input(
                "p",
                "pt",
                &parent_scope_id,
                "ct",
                &dir.path().to_string_lossy(),
                "feature/child",
                SourceControlWorktreeHistoryMode::Normal,
            ),
            &registry,
            None,
        )
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );
    }

    #[test]
    fn rejects_create_when_parent_trunk_mismatches_scope() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let parent_scope_id = register_parent_scope(&registry, dir.path(), "p", "pt");

        let err = create_worktree_with(
            &SystemGitProcess,
            create_input(
                "p",
                "other-trunk",
                &parent_scope_id,
                "ct",
                &dir.path().to_string_lossy(),
                "feature/child",
                SourceControlWorktreeHistoryMode::Normal,
            ),
            &registry,
            None,
        )
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );
    }

    #[test]
    fn creates_worktree_from_registered_parent_scope() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let result = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/child",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        assert!(Path::new(&result.checkout.checkout_path).exists());
        assert!(!result.checkout.scope_id.is_empty());

        let _ = std::fs::remove_dir_all(&result.checkout.checkout_path);
    }

    #[test]
    fn rejects_create_on_non_repository() {
        let dir = tempdir().unwrap();
        let registry = SourceControlScopeRegistry::default();
        let err = create_worktree_with(
            &SystemGitProcess,
            create_input(
                "p",
                "pt",
                "missing-scope",
                "ct",
                &dir.path().to_string_lossy(),
                "feature/child",
                SourceControlWorktreeHistoryMode::Normal,
            ),
            &registry,
            None,
        )
        .unwrap_err();
        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );
    }

    #[test]
    fn attaches_existing_worktree() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/attach",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        let attached = attach_worktree_with(
            &SystemGitProcess,
            SourceControlAttachWorktreeInput {
                project_id: "p".into(),
                parent_trunk_id: "pt".into(),
                trunk_id: "ct2".into(),
                project_folder_path: dir.path().to_string_lossy().into_owned(),
                worktree_path: created.checkout.checkout_path.clone(),
            },
            &registry,
        )
        .unwrap();

        assert_eq!(
            attached.checkout.checkout_path,
            created.checkout.checkout_path
        );
        assert_eq!(
            attached.checkout.repository_identity,
            created.checkout.repository_identity
        );

        let _ = std::fs::remove_dir_all(&created.checkout.checkout_path);
    }

    #[test]
    fn rejects_attach_worktree_from_different_repository() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let other = tempdir().unwrap();
        init_repo(other.path());
        commit(other.path(), "other.md");

        let other_registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &other_registry,
            other.path(),
            "p",
            "pt",
            "ct",
            "feature/other",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        let err = attach_worktree_with(
            &SystemGitProcess,
            SourceControlAttachWorktreeInput {
                project_id: "p".into(),
                parent_trunk_id: "pt".into(),
                trunk_id: "ct2".into(),
                project_folder_path: dir.path().to_string_lossy().into_owned(),
                worktree_path: created.checkout.checkout_path.clone(),
            },
            &SourceControlScopeRegistry::default(),
        )
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );

        let _ = std::fs::remove_dir_all(&created.checkout.checkout_path);
    }

    #[test]
    fn inspects_and_removes_worktree() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/to-remove",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        let repository_identity = created
            .checkout
            .repository_identity
            .clone()
            .unwrap_or_default();
        let inspection = inspect_worktree_removal(InspectWorktreeRemovalInput {
            worktree_path: created.checkout.checkout_path.clone(),
            repository_identity: repository_identity.clone(),
            affected_trunk_ids: vec!["ct".into()],
        })
        .unwrap();

        assert!(!inspection.dirty);
        assert!(!inspection.has_unmerged_changes);
        assert!(inspection.head_oid.is_some());
        assert!(inspection.managed_by_app);

        let scope_id = created.checkout.scope_id.clone();
        remove_worktree_with(
            &SystemGitProcess,
            SourceControlRemoveWorktreeInput {
                scope_id: Some(scope_id.clone()),
                worktree_path: created.checkout.checkout_path.clone(),
                repository_identity,
                expected_head_oid: inspection.head_oid.clone(),
                allow_dirty: false,
                allow_unmerged_changes: false,
                allow_unmerged_commits: false,
            },
            &registry,
            None,
        )
        .unwrap();

        assert!(!Path::new(&created.checkout.checkout_path).exists());
        assert!(registry.resolve(&scope_id, "test").is_err());
    }

    #[test]
    fn refuses_remove_dirty_worktree_without_allow() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/dirty",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        fs::write(
            Path::new(&created.checkout.checkout_path).join("dirty.txt"),
            "unsaved",
        )
        .unwrap();

        let repository_identity = created
            .checkout
            .repository_identity
            .clone()
            .unwrap_or_default();
        let inspection = inspect_worktree_removal(InspectWorktreeRemovalInput {
            worktree_path: created.checkout.checkout_path.clone(),
            repository_identity: repository_identity.clone(),
            affected_trunk_ids: vec!["ct".into()],
        })
        .unwrap();

        assert!(inspection.dirty);

        let err = remove_worktree_with(
            &SystemGitProcess,
            SourceControlRemoveWorktreeInput {
                scope_id: None,
                worktree_path: created.checkout.checkout_path.clone(),
                repository_identity: repository_identity.clone(),
                expected_head_oid: inspection.head_oid,
                allow_dirty: false,
                allow_unmerged_changes: false,
                allow_unmerged_commits: false,
            },
            &registry,
            None,
        )
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::PreconditionFailed
        );

        remove_worktree_with(
            &SystemGitProcess,
            SourceControlRemoveWorktreeInput {
                scope_id: None,
                worktree_path: created.checkout.checkout_path.clone(),
                repository_identity,
                expected_head_oid: None,
                allow_dirty: true,
                allow_unmerged_changes: false,
                allow_unmerged_commits: false,
            },
            &registry,
            None,
        )
        .unwrap();

        assert!(!Path::new(&created.checkout.checkout_path).exists());
    }

    #[test]
    fn rejects_duplicate_branch_creation() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/child",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        let parent_scope_id = register_parent_scope(&registry, dir.path(), "p", "pt");
        let result = create_worktree_with(
            &SystemGitProcess,
            create_input(
                "p",
                "pt",
                &parent_scope_id,
                "ct2",
                &dir.path().to_string_lossy(),
                "feature/child",
                SourceControlWorktreeHistoryMode::Normal,
            ),
            &registry,
            None,
        );

        assert!(result.is_err());

        let _ = std::fs::remove_dir_all(&created.checkout.checkout_path);
    }

    #[test]
    fn rejects_prefix_repository_identity_on_inspect() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/prefix",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        let actual = created
            .checkout
            .repository_identity
            .clone()
            .unwrap_or_default();
        let prefix = actual.trim_end_matches(".git").to_string();
        assert_ne!(prefix, actual);
        let err = inspect_worktree_removal(InspectWorktreeRemovalInput {
            worktree_path: created.checkout.checkout_path.clone(),
            repository_identity: prefix,
            affected_trunk_ids: vec![],
        })
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );

        let _ = std::fs::remove_dir_all(&created.checkout.checkout_path);
    }

    #[test]
    fn rejects_empty_repository_identity() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/empty-id",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        let err = inspect_worktree_removal(InspectWorktreeRemovalInput {
            worktree_path: created.checkout.checkout_path.clone(),
            repository_identity: String::new(),
            affected_trunk_ids: vec![],
        })
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::CheckoutInvalid
        );

        let _ = std::fs::remove_dir_all(&created.checkout.checkout_path);
    }

    #[test]
    fn rejects_expected_head_mismatch_on_remove() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/head",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        let repository_identity = created
            .checkout
            .repository_identity
            .clone()
            .unwrap_or_default();
        let err = remove_worktree_with(
            &SystemGitProcess,
            SourceControlRemoveWorktreeInput {
                scope_id: None,
                worktree_path: created.checkout.checkout_path.clone(),
                repository_identity,
                expected_head_oid: Some("deadbeef".into()),
                allow_dirty: false,
                allow_unmerged_changes: false,
                allow_unmerged_commits: false,
            },
            &registry,
            None,
        )
        .unwrap_err();

        assert_eq!(
            err.code,
            crate::source_control::contracts::PublicSourceControlErrorCode::PreconditionFailed
        );

        let _ = std::fs::remove_dir_all(&created.checkout.checkout_path);
    }

    #[test]
    fn classifies_managed_root_membership_by_canonical_path() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let registry = SourceControlScopeRegistry::default();
        let created = create_worktree_for_test(
            &registry,
            dir.path(),
            "p",
            "pt",
            "ct",
            "feature/managed",
            SourceControlWorktreeHistoryMode::Normal,
        )
        .unwrap();

        assert!(is_managed_worktree_path(Path::new(
            &created.checkout.checkout_path
        )));
        assert!(!is_managed_worktree_path(dir.path()));

        let _ = std::fs::remove_dir_all(&created.checkout.checkout_path);
    }

    #[test]
    fn attached_worktree_outside_managed_root_is_not_recursively_deleted() {
        let dir = tempdir().unwrap();
        init_repo(dir.path());
        commit(dir.path(), "readme.md");

        let external = dir.path().join("external-wt");
        assert!(Command::new("git")
            .args([
                "-C",
                dir.path().to_str().unwrap(),
                "worktree",
                "add",
                "-b",
                "feature/external",
                external.to_str().unwrap(),
                "main",
            ])
            .status()
            .unwrap()
            .success());

        let marker = external.join("keep-me.txt");
        fs::write(&marker, "stay").unwrap();
        assert!(Command::new("git")
            .args(["-C", external.to_str().unwrap(), "add", "keep-me.txt",])
            .status()
            .unwrap()
            .success());
        assert!(Command::new("git")
            .args(["-C", external.to_str().unwrap(), "commit", "-m", "marker"])
            .status()
            .unwrap()
            .success());
        let scope = detect_repository(&SystemGitProcess, &external).unwrap();
        assert!(!is_managed_worktree_path(&external));

        let registry = SourceControlScopeRegistry::default();
        remove_worktree_with(
            &SystemGitProcess,
            SourceControlRemoveWorktreeInput {
                scope_id: None,
                worktree_path: external.to_string_lossy().into_owned(),
                repository_identity: scope.repository_identity.clone(),
                expected_head_oid: None,
                allow_dirty: false,
                allow_unmerged_changes: false,
                allow_unmerged_commits: false,
            },
            &registry,
            None,
        )
        .unwrap();

        assert!(!external.exists());
        assert!(dir.path().exists());
        assert!(!is_managed_worktree_path(&external));
    }

    #[test]
    fn parses_worktree_list_z_output() {
        let output = b"worktree /path/to/main\nHEAD abc123\nbranch refs/heads/main\n\nworktree /path/to/wt\nHEAD def456\nbranch refs/heads/feature/x\nlocked\nlocked reason testing\n";

        let entries = parse_worktree_list(output);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].path, "/path/to/main");
        assert!(entries[0].is_current);
        assert!(!entries[0].locked);
        assert_eq!(entries[1].path, "/path/to/wt");
        assert!(entries[1].locked);
        assert_eq!(entries[1].locked_reason.as_deref(), Some("reason testing"));
    }
}
