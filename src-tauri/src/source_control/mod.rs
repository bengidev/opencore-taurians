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
pub mod submodule;
pub mod worktree;

use contracts::{
    SourceControlCheckoutRequest, SourceControlInitializeInput, SourceControlRepositorySnapshot, SourceControlResolveCheckoutInput,
    SourceControlResolveCheckoutResult, PublicSourceControlError,
};
use repository::SourceControlRepositoryState;
use tauri::State;
use worktree::{
    SourceControlAttachWorktreeInput, SourceControlCreateWorktreeInput, SourceControlRemoveWorktreeInput, SourceControlRepairWorktreeInput,
    SourceControlWorktreeMutationResult, SourceControlWorktreeRemovalInspection, InspectWorktreeRemovalInput,
};

#[tauri::command]
pub fn git_resolve_checkout(input: SourceControlResolveCheckoutInput) -> SourceControlResolveCheckoutResult {
    scope::resolve_checkout(input)
}

#[tauri::command]
pub fn git_get_snapshot(
    input: SourceControlCheckoutRequest,
    state: State<'_, SourceControlRepositoryState>,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    repository::get_snapshot(&state, input)
}

#[tauri::command]
pub fn git_refresh(
    input: SourceControlCheckoutRequest,
    state: State<'_, SourceControlRepositoryState>,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    repository::refresh(&state, input)
}

#[tauri::command]
pub fn git_initialize(
    input: SourceControlInitializeInput,
    state: State<'_, SourceControlRepositoryState>,
) -> Result<SourceControlRepositorySnapshot, PublicSourceControlError> {
    repository::initialize(&state, input)
}

#[tauri::command]
pub fn git_get_diff(input: diff::SourceControlDiffInput) -> Result<diff::SourceControlDiffResult, PublicSourceControlError> {
    diff::get_diff(input)
}

#[tauri::command]
pub fn git_stage(
    input: mutations::SourceControlStageInput,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    mutations::stage(input)
}

#[tauri::command]
pub fn git_discard(
    input: mutations::SourceControlDiscardInput,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    mutations::discard(input)
}

#[tauri::command]
pub fn git_commit(
    input: mutations::SourceControlCommitInput,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    mutations::commit(input)
}

#[tauri::command]
pub fn git_stash(
    input: mutations::SourceControlStashInput,
) -> Result<mutations::SourceControlMutationResult, PublicSourceControlError> {
    mutations::stash(input)
}

#[tauri::command]
pub fn git_fetch(input: remote::SourceControlFetchInput) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    remote::git_fetch(input)
}
#[tauri::command]
pub fn git_pull(input: remote::SourceControlPullInput) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    remote::git_pull(input)
}
#[tauri::command]
pub fn git_push(input: remote::SourceControlPushInput) -> Result<remote::SourceControlRemoteResult, PublicSourceControlError> {
    remote::git_push(input)
}

#[tauri::command]
pub fn git_list_refs(checkout_path: String) -> Result<Vec<refs::SourceControlRefSummary>, PublicSourceControlError> {
    refs::list_refs(checkout_path)
}
#[tauri::command]
pub fn git_mutate_ref(
    input: refs::SourceControlRefMutationInput,
) -> Result<refs::SourceControlRefMutationResult, PublicSourceControlError> {
    refs::mutate_ref(input)
}

#[tauri::command]
pub fn git_log(input: history::SourceControlLogInput) -> Result<Vec<history::SourceControlLogEntry>, PublicSourceControlError> {
    history::git_log(input)
}
#[tauri::command]
pub fn git_compare(
    input: history::SourceControlCompareInput,
) -> Result<history::SourceControlCompareResult, PublicSourceControlError> {
    history::git_compare(input)
}

#[tauri::command]
pub fn git_submodule(input: submodule::SourceControlSubmoduleInput) -> Result<String, PublicSourceControlError> {
    submodule::submodule_action(input)
}

#[tauri::command]
pub fn git_lfs(input: lfs::SourceControlLfsInput) -> Result<String, PublicSourceControlError> {
    lfs::lfs_action(input)
}

#[tauri::command]
pub fn git_clone(input: clone::SourceControlCloneInput) -> Result<clone::SourceControlCloneResult, PublicSourceControlError> {
    clone::clone_repository(input)
}

#[tauri::command]
pub fn git_enumerate_hooks(
    checkout_path: String,
) -> Result<Vec<hooks::SourceControlHookInfo>, PublicSourceControlError> {
    hooks::enumerate_hooks(&checkout_path)
}

#[tauri::command]
pub fn git_worktree_create(
    input: SourceControlCreateWorktreeInput,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    worktree::create_worktree(input)
}

#[tauri::command]
pub fn git_worktree_attach(
    input: SourceControlAttachWorktreeInput,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    worktree::attach_worktree(input)
}

#[tauri::command]
pub fn git_worktree_repair(
    input: SourceControlRepairWorktreeInput,
) -> Result<SourceControlWorktreeMutationResult, PublicSourceControlError> {
    worktree::repair_worktree(input)
}

#[tauri::command]
pub fn git_worktree_inspect_removal(
    input: InspectWorktreeRemovalInput,
) -> Result<SourceControlWorktreeRemovalInspection, PublicSourceControlError> {
    worktree::inspect_worktree_removal(input)
}

#[tauri::command]
pub fn git_worktree_remove(input: SourceControlRemoveWorktreeInput) -> Result<(), PublicSourceControlError> {
    worktree::remove_worktree(input)
}
