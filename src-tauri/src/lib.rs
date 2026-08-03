mod editor;
mod explorer;
mod path_scope;
mod provider;
mod quit;
mod source_control;
mod terminal;
mod watch;

use source_control::scope_registry::SourceControlScopeRegistry;
use tauri::{Emitter, Manager, RunEvent, State};
use terminal::registry::TerminalSessionState;

use watch::{WatchBroker, WatchSubscribeInput, WatchUnsubscribeInput};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn watch_subscribe(
    input: WatchSubscribeInput,
    app: tauri::AppHandle,
    broker: State<'_, WatchBroker>,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<(), String> {
    broker.subscribe(input, &registry, Some(&app))
}

#[tauri::command]
fn watch_unsubscribe(
    input: WatchUnsubscribeInput,
    broker: State<'_, WatchBroker>,
    registry: State<'_, SourceControlScopeRegistry>,
) -> Result<(), String> {
    broker.unsubscribe(input, &registry)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let terminal_state = TerminalSessionState::default();
    let quit_guard = quit::QuitGuard::default();
    quit_guard.register_terminal_state(terminal_state.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(source_control::repository::SourceControlRepositoryState::default())
        .manage(source_control::scope_registry::SourceControlScopeRegistry::default())
        .manage(source_control::coordinator::SourceControlOperationCoordinatorState::default())
        .manage(watch::WatchBroker::default())
        .manage(quit_guard)
        .manage(terminal_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            editor::read::editor_read_file,
            editor::read_external::editor_read_external_file,
            editor::write::editor_write_file,
            editor::create::editor_create_file,
            editor::path_query::editor_is_under_root,
            editor::path_query::editor_paths_include_directory,
            explorer::list_dir::explorer_list_dir,
            explorer::create::explorer_create_file,
            explorer::create::explorer_create_dir,
            explorer::rename::explorer_rename,
            explorer::trash::explorer_trash,
            explorer::duplicate::explorer_duplicate,
            explorer::copy::explorer_copy_paths,
            explorer::reveal::explorer_reveal,
            source_control::git_resolve_checkout,
            source_control::git_get_snapshot,
            source_control::git_refresh,
            source_control::git_initialize,
            source_control::git_worktree_create,
            source_control::git_worktree_attach,
            source_control::git_worktree_repair,
            source_control::git_worktree_inspect_removal,
            source_control::git_worktree_remove,
            source_control::git_get_diff,
            source_control::git_stage,
            source_control::git_discard,
            source_control::git_commit,
            source_control::git_stash,
            source_control::git_fetch,
            source_control::git_pull,
            source_control::git_push,
            source_control::git_list_refs,
            source_control::git_mutate_ref,
            source_control::git_log,
            source_control::git_compare,
            source_control::git_submodule,
            source_control::git_lfs,
            source_control::git_clone,
            source_control::git_enumerate_hooks,
            source_control::coordinator::git_operation_cancel,
            watch_subscribe,
            watch_unsubscribe,
            terminal::commands::terminal_spawn,
            terminal::commands::terminal_write,
            terminal::commands::terminal_resize,
            terminal::commands::terminal_get_size,
            terminal::commands::terminal_kill,
            provider::keychain::keychain_save,
            provider::keychain::keychain_read,
            provider::keychain::keychain_delete,
            provider::keychain::provider_credential_save,
            provider::keychain::provider_credential_status,
            provider::keychain::provider_credential_delete,
            provider::service::provider_list_repositories,
            provider::service::provider_get_repository,
            provider::service::provider_create_repository,
            provider::service::provider_list_pull_requests,
            provider::service::provider_get_pull_request,
            provider::service::provider_create_pull_request,
            provider::service::provider_create_release,
            provider::service::provider_release_capabilities,
        ])
        .on_window_event(|window, event| {
            use tauri::{DragDropEvent, WindowEvent};
            if let WindowEvent::DragDrop(drag) = event {
                match drag {
                    DragDropEvent::Enter { paths, position } => {
                        let _ = window.emit(
                            "explorer://drag",
                            serde_json::json!({
                                "phase": "enter",
                                "paths": paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>(),
                                "x": position.x,
                                "y": position.y,
                            }),
                        );
                    }
                    DragDropEvent::Over { position } => {
                        let _ = window.emit(
                            "explorer://drag",
                            serde_json::json!({
                                "phase": "over",
                                "paths": [],
                                "x": position.x,
                                "y": position.y,
                            }),
                        );
                    }
                    DragDropEvent::Leave => {
                        let _ = window.emit(
                            "explorer://drag",
                            serde_json::json!({
                                "phase": "leave",
                                "paths": [],
                                "x": 0,
                                "y": 0,
                            }),
                        );
                    }
                    DragDropEvent::Drop { paths, position } => {
                        let _ = window.emit(
                            "explorer://drop",
                            serde_json::json!({
                                "paths": paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>(),
                                "x": position.x,
                                "y": position.y,
                            }),
                        );
                    }
                    _ => {}
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                // Kill all live terminal sessions before the process exits so no
                // shell/PTY child processes are orphaned.
                let quit = app.state::<quit::QuitGuard>();
                quit.kill_all_terminal_sessions();
            }
        });
}
