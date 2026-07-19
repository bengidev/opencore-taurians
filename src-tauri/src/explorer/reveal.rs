use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use super::error::ExplorerError;

#[tauri::command]
pub fn explorer_reveal(path: String, app: AppHandle) -> Result<(), ExplorerError> {
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|e| ExplorerError::Io(e.to_string()))
}
