use std::path::Path;

use serde::Deserialize;

use super::error::ExplorerError;
use crate::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerPathInput {
    pub project_root: String,
    pub path: String,
}

#[tauri::command]
pub fn explorer_trash(input: ExplorerPathInput) -> Result<(), ExplorerError> {
    let path = ensure_under_root(Path::new(&input.project_root), Path::new(&input.path))
        .map_err(|_| ExplorerError::OutsideProject(input.path.clone()))?;
    if !path.exists() {
        return Err(ExplorerError::NotFound(input.path));
    }
    trash::delete(&path).map_err(|e| ExplorerError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn trashes_file() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("foo.txt");
        fs::write(&file, "content").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        explorer_trash(ExplorerPathInput {
            project_root: root,
            path: file.to_string_lossy().into_owned(),
        })
        .unwrap();
        assert!(!file.exists());
    }

    #[test]
    fn rejects_path_outside_project() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("outside-trash-test.txt");
        fs::write(&outside, "x").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let result = explorer_trash(ExplorerPathInput {
            project_root: root,
            path: outside.to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(ExplorerError::OutsideProject(_))));
        assert!(outside.exists());
        let _ = fs::remove_file(outside);
    }
}
