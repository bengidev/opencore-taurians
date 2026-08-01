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
use repository::SourceControlRepositoryState;
use scope_registry::SourceControlScopeRegistry;
use tauri::State;
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
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "stage")?;
    mutations::stage(input, &scope)
}

#[tauri::command]
pub fn git_discard(
    input: mutations::SourceControlDiscardInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "discard")?;
    mutations::discard(input, &scope)
}

#[tauri::command]
pub fn git_commit(
    input: mutations::SourceControlCommitInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "commit")?;
    mutations::commit(input, &scope)
}

#[tauri::command]
pub fn git_stash(
    input: mutations::SourceControlStashInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "stash")?;
    mutations::stash(input, &scope)
}

#[tauri::command]
pub fn git_fetch(
    input: remote::SourceControlFetchInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "fetch")?;
    remote::git_fetch(input, &scope)
}

#[tauri::command]
pub fn git_pull(
    input: remote::SourceControlPullInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "pull")?;
    remote::git_pull(input, &scope)
}

#[tauri::command]
pub fn git_push(
    input: remote::SourceControlPushInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "push")?;
    remote::git_push(input, &scope)
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
) -> Result<refs::SourceControlRefMutationResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "mutate-ref")?;
    refs::mutate_ref(input, &scope)
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
) -> Result<String, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "submodule")?;
    submodule::submodule_action(input, &scope)
}

#[tauri::command]
pub fn git_lfs(
    input: lfs::SourceControlLfsInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<String, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "lfs")?;
    lfs::lfs_action(input, &scope)
}

#[tauri::command]
pub fn git_clone(
    input: clone::SourceControlCloneInput,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<clone::SourceControlCloneResult, PublicSourceControlError> {
    let scope = registry.resolve(&input.scope_id, "clone")?;
    clone::clone_repository(input, &scope)
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
    _registry: State<'_, SourceControlScopeRegistry>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    worktree::create_worktree(input)
}

#[tauri::command]
pub fn git_worktree_attach(
    input: SourceControlAttachWorktreeInput,
    _registry: State<'_, SourceControlScopeRegistry>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    worktree::attach_worktree(input)
}

#[tauri::command]
pub fn git_worktree_repair(
    input: SourceControlRepairWorktreeInput,
    _registry: State<'_, SourceControlScopeRegistry>,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    worktree::repair_worktree(input)
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
    _registry: State<'_, SourceControlScopeRegistry>,
) -> Result<(), PublicSourceControlError> {
    worktree::remove_worktree(input)
}
