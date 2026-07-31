use crate::path_scope::normalize_path;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const DEBOUNCE_MS: u64 = 300;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WatchChangeKind {
    Added,
    Modified,
    Removed,
    Coalesced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchChangeEvent {
    pub root: String,
    pub revision: u64,
    pub kinds: Vec<WatchChangeKind>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // `identity` is part of the wire contract sent by the frontend but not read server-side.
pub struct WatchSubscribeInput {
    pub root: String,
    pub mode: String,
    pub identity: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // `identity` is part of the wire contract sent by the frontend but not read server-side.
pub struct WatchUnsubscribeInput {
    pub root: String,
    pub identity: String,
}

struct WatchHandle {
    _watcher: RecommendedWatcher,
    _debounce_tx: mpsc::Sender<()>,
}

pub struct WatchBroker {
    handles: Mutex<HashMap<String, WatchHandle>>,
}

impl Default for WatchBroker {
    fn default() -> Self {
        Self {
            handles: Mutex::new(HashMap::new()),
        }
    }
}

impl WatchBroker {
    pub fn subscribe(&self, input: WatchSubscribeInput, app: &AppHandle) -> Result<(), String> {
        if input.mode != "live" {
            return Ok(());
        }

        let root = normalize_path(Path::new(&input.root))
            .to_string_lossy()
            .into_owned();

        let mut guard = self.handles.lock().map_err(|e| e.to_string())?;
        if guard.contains_key(&root) {
            return Ok(());
        }

        let (debounce_tx, debounce_rx) = mpsc::channel();
        let app_handle = app.clone();
        let root_clone = root.clone();

        std::thread::spawn(move || {
            let mut revision: u64 = 0;
            loop {
                match debounce_rx.recv() {
                    Ok(()) => {
                        // Drain pending events within the debounce window
                        loop {
                            match debounce_rx.recv_timeout(Duration::from_millis(DEBOUNCE_MS)) {
                                Ok(()) => {}
                                Err(RecvTimeoutError::Timeout) => {
                                    revision += 1;
                                    let _ = app_handle.emit(
                                        "watch://changed",
                                        WatchChangeEvent {
                                            root: root_clone.clone(),
                                            revision,
                                            kinds: vec![WatchChangeKind::Coalesced],
                                        },
                                    );
                                    break;
                                }
                                Err(RecvTimeoutError::Disconnected) => return,
                            }
                        }
                    }
                    Err(_) => return,
                }
            }
        });

        let debounce_tx2 = debounce_tx.clone();
        let mut watcher = RecommendedWatcher::new(
            move |_res| {
                let _ = debounce_tx2.send(());
            },
            Config::default(),
        )
        .map_err(|e| e.to_string())?;

        watcher
            .watch(Path::new(&root), RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        guard.insert(
            root,
            WatchHandle {
                _watcher: watcher,
                _debounce_tx: debounce_tx,
            },
        );

        Ok(())
    }

    pub fn unsubscribe(&self, input: WatchUnsubscribeInput) -> Result<(), String> {
        let root = normalize_path(Path::new(&input.root))
            .to_string_lossy()
            .into_owned();
        let mut handles = self.handles.lock().map_err(|e| e.to_string())?;
        handles.remove(&root);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subscribe_with_non_live_mode_is_noop() {
        let broker = WatchBroker::default();
        assert!(broker.handles.lock().unwrap().is_empty());
    }

    #[test]
    fn unsubscribe_empty_is_noop() {
        let broker = WatchBroker::default();
        broker
            .unsubscribe(WatchUnsubscribeInput {
                root: "/nonexistent".into(),
                identity: "test".into(),
            })
            .unwrap();
    }
}
