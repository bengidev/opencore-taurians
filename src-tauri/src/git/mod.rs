pub mod contracts;
pub mod parse;
pub mod process;
pub mod repository;
pub mod scope;

use contracts::{
    GitCheckoutRequest, GitInitializeInput, GitRepositorySnapshot, GitResolveCheckoutInput,
    GitResolveCheckoutResult, PublicGitError,
};
use repository::GitRepositoryState;
use tauri::State;

#[tauri::command]
pub fn git_resolve_checkout(input: GitResolveCheckoutInput) -> GitResolveCheckoutResult {
    scope::resolve_checkout(input)
}

#[tauri::command]
pub fn git_get_snapshot(
    input: GitCheckoutRequest,
    state: State<'_, GitRepositoryState>,
) -> Result<GitRepositorySnapshot, PublicGitError> {
    repository::get_snapshot(&state, input)
}

#[tauri::command]
pub fn git_refresh(
    input: GitCheckoutRequest,
    state: State<'_, GitRepositoryState>,
) -> Result<GitRepositorySnapshot, PublicGitError> {
    repository::refresh(&state, input)
}

#[tauri::command]
pub fn git_initialize(
    input: GitInitializeInput,
    state: State<'_, GitRepositoryState>,
) -> Result<GitRepositorySnapshot, PublicGitError> {
    repository::initialize(&state, input)
}
