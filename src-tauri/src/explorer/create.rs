use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::ExplorerError;
use super::list_dir::ExplorerEntry;
use super::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
pub struct ExplorerCreateFileInput {
    pub project_root: String,
    pub parent_dir: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct ExplorerCreateDirInput {
    pub project_root: String,
    pub parent_dir: String,
    pub name: String,
}

#[tauri::command]
pub fn explorer_create_file(input: ExplorerCreateFileInput) -> Result<ExplorerEntry, ExplorerError> {
    let parent = ensure_under_root(Path::new(&input.project_root), Path::new(&input.parent_dir))
        .map_err(|_| ExplorerError::OutsideProject(input.parent_dir.clone()))?;
    let target = parent.join(&input.name);
    if target.exists() {
        return Err(ExplorerError::AlreadyExists(
            target.to_string_lossy().into_owned(),
        ));
    }
    fs::write(&target, "")?;
    Ok(ExplorerEntry {
        name: input.name,
        path: target.to_string_lossy().into_owned(),
        is_dir: false,
    })
}

#[tauri::command]
pub fn explorer_create_dir(input: ExplorerCreateDirInput) -> Result<ExplorerEntry, ExplorerError> {
    let parent = ensure_under_root(Path::new(&input.project_root), Path::new(&input.parent_dir))
        .map_err(|_| ExplorerError::OutsideProject(input.parent_dir.clone()))?;
    let target = parent.join(&input.name);
    if target.exists() {
        return Err(ExplorerError::AlreadyExists(
            target.to_string_lossy().into_owned(),
        ));
    }
    fs::create_dir(&target)?;
    Ok(ExplorerEntry {
        name: input.name,
        path: target.to_string_lossy().into_owned(),
        is_dir: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn creates_untitled_file_under_parent() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let entry = explorer_create_file(ExplorerCreateFileInput {
            project_root: root.clone(),
            parent_dir: root.clone(),
            name: "untitled".into(),
        })
        .unwrap();
        assert_eq!(entry.name, "untitled");
        assert!(!entry.is_dir);
        assert!(Path::new(&entry.path).exists());
        assert_eq!(fs::read_to_string(&entry.path).unwrap(), "");
    }

    #[test]
    fn errors_on_file_collision() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        fs::write(dir.path().join("untitled"), "existing").unwrap();
        let result = explorer_create_file(ExplorerCreateFileInput {
            project_root: root.clone(),
            parent_dir: root,
            name: "untitled".into(),
        });
        assert!(matches!(result, Err(ExplorerError::AlreadyExists(_))));
    }
}
