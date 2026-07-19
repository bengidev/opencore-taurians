use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::time::Duration;

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use super::error::ExplorerError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerWatchInput {
    pub project_root: String,
    pub mode: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerUnwatchInput {
    pub project_root: String,
}

pub struct ExplorerWatchState(pub Mutex<HashMap<String, RecommendedWatcher>>);

impl Default for ExplorerWatchState {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

fn spawn_debouncer(app: AppHandle, project_root: String) -> mpsc::Sender<()> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        while rx.recv().is_ok() {
            loop {
                match rx.recv_timeout(Duration::from_millis(300)) {
                    Ok(()) => {}
                    Err(RecvTimeoutError::Timeout) => {
                        let _ = app.emit(
                            "explorer://changed",
                            serde_json::json!({ "projectRoot": project_root }),
                        );
                        break;
                    }
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
        }
    });
    tx
}

fn watch_project(
    project_root: String,
    app: &AppHandle,
    watchers: &mut HashMap<String, RecommendedWatcher>,
) -> Result<(), ExplorerError> {
    let debounce_tx = spawn_debouncer(app.clone(), project_root.clone());

    let mut watcher = RecommendedWatcher::new(
        move |_res| {
            let _ = debounce_tx.send(());
        },
        Config::default(),
    )
    .map_err(|e| ExplorerError::Io(e.to_string()))?;

    watcher
        .watch(Path::new(&project_root), RecursiveMode::Recursive)
        .map_err(|e| ExplorerError::Io(e.to_string()))?;

    watchers.insert(project_root, watcher);
    Ok(())
}

fn explorer_watch_impl(
    input: ExplorerWatchInput,
    state: &ExplorerWatchState,
    app: Option<&AppHandle>,
) -> Result<(), ExplorerError> {
    if input.mode != "live" {
        state.0.lock().unwrap().remove(&input.project_root);
        return Ok(());
    }

    let app = app.ok_or_else(|| ExplorerError::Invalid("app handle required".to_string()))?;

    let mut watchers = state.0.lock().unwrap();
    watchers.remove(&input.project_root);
    watch_project(input.project_root, app, &mut watchers)
}

#[tauri::command]
pub fn explorer_watch(
    input: ExplorerWatchInput,
    app: AppHandle,
    state: State<ExplorerWatchState>,
) -> Result<(), ExplorerError> {
    explorer_watch_impl(input, &state, Some(&app))
}

#[tauri::command]
pub fn explorer_unwatch(
    input: ExplorerUnwatchInput,
    state: State<ExplorerWatchState>,
) -> Result<(), ExplorerError> {
    state.0.lock().unwrap().remove(&input.project_root);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn on_activate_mode_does_not_register_watcher() {
        let state = ExplorerWatchState::default();
        explorer_watch_impl(
            ExplorerWatchInput {
                project_root: "/tmp/test".to_string(),
                mode: "on-activate".to_string(),
            },
            &state,
            None,
        )
        .unwrap();
        assert!(state.0.lock().unwrap().is_empty());
    }
}
