pub mod clone;
pub mod contracts;
pub mod coordinator;
pub mod diff;
pub mod history;
pub mod hooks;
pub mod lfs;
pub mod mutations;
pub mod parse;
pub mod process;
pub mod refs;
pub mod remote;
pub mod repository;
pub mod scope;
pub mod scope_registry;
pub mod submodule;
pub mod worktree;
use contracts::{
    PublicSourceControlError, SourceControlCheckoutRequest, SourceControlInitializeInput,
    SourceControlRepositorySnapshot, SourceControlResolveCheckoutInput,
    SourceControlResolveCheckoutResult,
};
use coordinator::{
    run_coordinated, run_coordinated_identity, SourceControlOperationCoordinatorState,
};
use crate::quit::QuitGuard;
use repository::SourceControlRepositoryState;
use scope_registry::SourceControlScopeRegistry;
use tauri::{AppHandle, State};
use worktree::{
    InspectWorktreeRemovalInput, SourceControlAttachWorktreeInput,
    SourceControlCreateWorktreeInput, SourceControlRemoveWorktreeInput,
    SourceControlRepairWorktreeInput, SourceControlWorktreeMutationResult,
    SourceControlWorktreeRemovalInspection,
};

#[tauri::command]
pub fn git_resolve_checkout(
    input: SourceControlResolveCheckoutInput,
    state: State<'_, SourceControlScopeRegistry>,
) -> SourceControlResolveCheckoutResult {
    scope::resolve_checkout_in_registry(input, &state)
}

#[tauri::command]
pub fn git_get_snapshot(
    input: SourceControlCheckoutRequest,
    repository_state: State<'_, SourceControlRepositoryState>,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "snapshot")?;
    repository::get_snapshot(input, &repository_state, &scope)
}

#[tauri::command]
pub fn git_refresh(
    input: SourceControlCheckoutRequest,
    repository_state: State<'_, SourceControlRepositoryState>,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "refresh")?;
    repository::refresh(input, &repository_state, &scope)
}

#[tauri::command]
pub fn git_initialize(
    input: SourceControlInitializeInput,
    repository_state: State<'_, SourceControlRepositoryState>,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "initialize")?;
    let snapshot = repository::initialize(input, &repository_state, &scope)?;
    registry.replace_repository_metadata(&scope.scope_id, snapshot.repository_identity.clone())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn git_get_diff(
    input: diff::SourceControlDiffInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<diff::SourceControlDiffResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "diff")?;
    diff::get_diff(input, &scope)
}

#[tauri::command]
pub fn git_stage(
    input: mutations::SourceControlStageInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "stage")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "stage", |ctx, coord| {
        let result = mutations::stage_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_discard(
    input: mutations::SourceControlDiscardInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "discard")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "discard", |ctx, coord| {
        let result = mutations::discard_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_commit(
    input: mutations::SourceControlCommitInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "commit")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "commit", |ctx, coord| {
        let result = mutations::commit_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_stash(
    input: mutations::SourceControlStashInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "stash")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "stash", |ctx, coord| {
        let result = mutations::stash_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_fetch(
    input: remote::SourceControlFetchInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "fetch")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "fetch", |ctx, coord| {
        let result = remote::git_fetch_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_pull(
    input: remote::SourceControlPullInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "pull")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "pull", |ctx, coord| {
        let result = remote::git_pull_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_push(
    input: remote::SourceControlPushInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "push")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "push", |ctx, coord| {
        let result = remote::git_push_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_list_refs(
    input: refs::SourceControlRefsInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<Vec<refs::SourceControlRefSummary>, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "list-refs")?;
    refs::list_refs(&scope)
}

#[tauri::command]
pub fn git_mutate_ref(
    input: refs::SourceControlRefMutationInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<refs::SourceControlRefMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "mutate-ref")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "mutate-ref", |ctx, coord| {
        let result = refs::mutate_ref_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        let summary = result.message.clone();
        Ok((result, summary))
    })
}

#[tauri::command]
pub fn git_log(
    input: history::SourceControlLogInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<Vec<history::SourceControlLogEntry>, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "log")?;
    history::git_log(input, &scope)
}

#[tauri::command]
pub fn git_compare(
    input: history::SourceControlCompareInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<history::SourceControlCompareResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "compare")?;
    history::git_compare(input, &scope)
}

#[tauri::command]
pub fn git_submodule(
    input: submodule::SourceControlSubmoduleInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<String, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "submodule")?;
    if matches!(input.action, submodule::SourceControlSubmoduleAction::Status) {
        return submodule::submodule_action(input, &scope);
    }
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "submodule", |ctx, coord| {
        let result = submodule::submodule_action_with(
            &process::SystemGitProcess,
            input,
            &scope,
            Some((ctx, coord)),
        )?;
        Ok((result.clone(), result))
    })
}

#[tauri::command]
pub fn git_lfs(
    input: lfs::SourceControlLfsInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<String, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "lfs")?;
    if matches!(
        input.action,
        lfs::SourceControlLfsAction::Status | lfs::SourceControlLfsAction::Availability
    ) {
        return lfs::lfs_action(input, &scope);
    }
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "lfs", |ctx, coord| {
        let result = lfs::lfs_action_with(&process::SystemGitProcess, input, &scope, Some((ctx, coord)))?;
        Ok((result.clone(), result))
    })
}

#[tauri::command]
pub fn git_clone(
    input: clone::SourceControlCloneInput,
    registry: State<'_, SourceControlScopeRegistry>,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<clone::SourceControlCloneResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "clone")?;
    run_coordinated(&coordinator, &scope, Some(&app), &quit, "clone", |ctx, coord| {
        let result = clone::clone_repository_with(
            &process::SystemGitProcess,
            input,
            &scope,
            Some((ctx, coord)),
        )?;
        Ok((result.clone(), result.message.clone()))
    })
}

#[tauri::command]
pub fn git_enumerate_hooks(
    input: hooks::SourceControlHooksInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<Vec<hooks::SourceControlHookInfo>, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "enumerate-hooks")?;
    hooks::enumerate_hooks(&scope)
}

#[tauri::command]
pub fn git_worktree_create(
    input: SourceControlCreateWorktreeInput,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    let repository_id = input.project_folder_path.clone();
    let trunk_id = input.trunk_id.clone();
    run_coordinated_identity(
        &coordinator,
        &repository_id,
        &trunk_id,
        Some(&app),
        &quit,
        "worktree-create",
        move |_ctx, _coord| {
            let result = worktree::create_worktree(input)?;
            Ok((result.clone(), "Worktree created".into()))
        },
    )
}

#[tauri::command]
pub fn git_worktree_attach(
    input: SourceControlAttachWorktreeInput,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    let repository_id = input.project_folder_path.clone();
    let trunk_id = input.trunk_id.clone();
    run_coordinated_identity(
        &coordinator,
        &repository_id,
        &trunk_id,
        Some(&app),
        &quit,
        "worktree-attach",
        move |_ctx, _coord| {
            let result = worktree::attach_worktree(input)?;
            Ok((result.clone(), "Worktree attached".into()))
        },
    )
}

#[tauri::command]
pub fn git_worktree_repair(
    input: SourceControlRepairWorktreeInput,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    let (repository_id, trunk_id) = match &input {
        SourceControlRepairWorktreeInput::Reattach { expected_repository_identity, trunk_id, .. } => {
            (expected_repository_identity.clone(), trunk_id.clone())
        }
        SourceControlRepairWorktreeInput::Recreate { expected_repository_identity, trunk_id, .. } => {
            (expected_repository_identity.clone(), trunk_id.clone())
        }
    };
    run_coordinated_identity(
        &coordinator,
        &repository_id,
        &trunk_id,
        Some(&app),
        &quit,
        "worktree-repair",
        move |_ctx, _coord| {
            let result = worktree::repair_worktree(input)?;
            Ok((result.clone(), "Worktree repaired".into()))
        },
    )
}

#[tauri::command]
pub fn git_worktree_inspect_removal(
    input: InspectWorktreeRemovalInput,
    _registry: State<'_, SourceControlScopeRegistry>,
) -> Result<SourceControlWorktreeRemovalInspection, PublicSourceControlError> {
    worktree::inspect_worktree_removal(input)
}

#[tauri::command]
pub fn git_worktree_remove(
    input: SourceControlRemoveWorktreeInput,
    coordinator: State<'_, SourceControlOperationCoordinatorState>,
    app: AppHandle,
    quit: State<'_, QuitGuard>,
) -> Result<(), PublicSourceControlError> {
    let repository_id = input.repository_identity.clone();
    run_coordinated_identity(
        &coordinator,
        &repository_id,
        &repository_id,
        Some(&app),
        &quit,
        "worktree-remove",
        move |_ctx, _coord| {
            worktree::remove_worktree(input)?;
            Ok(((), "Worktree removed".into()))
        },
    )
}
