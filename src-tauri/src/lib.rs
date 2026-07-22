mod editor;
mod explorer;
mod path_scope;

use explorer::ExplorerWatchState;
use tauri::Emitter;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(ExplorerWatchState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            editor::read::editor_read_file,
            editor::write::editor_write_file,
            explorer::list_dir::explorer_list_dir,
            explorer::create::explorer_create_file,
            explorer::create::explorer_create_dir,
            explorer::rename::explorer_rename,
            explorer::trash::explorer_trash,
            explorer::duplicate::explorer_duplicate,
            explorer::copy::explorer_copy_paths,
            explorer::watch::explorer_watch,
            explorer::watch::explorer_unwatch,
            explorer::reveal::explorer_reveal,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, position }) =
                event
            {
                let _ = window.emit(
                    "explorer://drop",
                    serde_json::json!({
                        "paths": paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>(),
                        "x": position.x,
                        "y": position.y,
                    }),
                );
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
