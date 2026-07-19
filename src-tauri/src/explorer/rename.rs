use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::ExplorerError;
use super::list_dir::ExplorerEntry;
use super::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
pub struct ExplorerRenameInput {
    pub project_root: String,
    pub path: String,
    pub new_name: String,
}

#[tauri::command]
pub fn explorer_rename(input: ExplorerRenameInput) -> Result<ExplorerEntry, ExplorerError> {
    let source = ensure_under_root(Path::new(&input.project_root), Path::new(&input.path))
        .map_err(|_| ExplorerError::OutsideProject(input.path.clone()))?;
    if !source.exists() {
        return Err(ExplorerError::NotFound(input.path));
    }
    let parent = source
        .parent()
        .ok_or_else(|| ExplorerError::Invalid("no parent".into()))?;
    let dest = ensure_under_root(
        Path::new(&input.project_root),
        &parent.join(&input.new_name),
    )
    .map_err(|_| ExplorerError::OutsideProject(input.new_name.clone()))?;
    if dest.exists() {
        return Err(ExplorerError::AlreadyExists(
            dest.to_string_lossy().into_owned(),
        ));
    }
    fs::rename(&source, &dest)?;
    let is_dir = dest.is_dir();
    Ok(ExplorerEntry {
        name: input.new_name,
        path: dest.to_string_lossy().into_owned(),
        is_dir,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn renames_untitled_to_main_rs() {
        let dir = tempdir().unwrap();
        let untitled = dir.path().join("untitled");
        fs::write(&untitled, "").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let entry = explorer_rename(ExplorerRenameInput {
            project_root: root.clone(),
            path: untitled.to_string_lossy().into_owned(),
            new_name: "main.rs".into(),
        })
        .unwrap();
        assert_eq!(entry.name, "main.rs");
        assert!(!entry.is_dir);
        assert!(dir.path().join("main.rs").exists());
        assert!(!untitled.exists());
    }

    #[test]
    fn rejects_traversal_name_on_rename() {
        let dir = tempdir().unwrap();
        let untitled = dir.path().join("untitled");
        fs::write(&untitled, "").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let result = explorer_rename(ExplorerRenameInput {
            project_root: root.clone(),
            path: untitled.to_string_lossy().into_owned(),
            new_name: "../moved.txt".into(),
        });
        assert!(matches!(result, Err(ExplorerError::OutsideProject(_))));
        assert!(untitled.exists());
        assert!(!dir.path().parent().unwrap().join("moved.txt").exists());
    }
}
