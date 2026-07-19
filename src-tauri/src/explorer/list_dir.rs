use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::error::ExplorerError;
use super::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
pub struct ExplorerListDirInput {
    pub project_root: String,
    pub dir_path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ExplorerEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn explorer_list_dir(input: ExplorerListDirInput) -> Result<Vec<ExplorerEntry>, ExplorerError> {
    let root = Path::new(&input.project_root);
    let dir = ensure_under_root(root, Path::new(&input.dir_path))
        .map_err(|_| ExplorerError::OutsideProject(input.dir_path.clone()))?;
    if !dir.is_dir() {
        return Err(ExplorerError::NotFound(input.dir_path));
    }
    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        entries.push(ExplorerEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            is_dir: file_type.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn lists_files_and_directories() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "hi").unwrap();
        fs::create_dir(dir.path().join("src")).unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let entries = explorer_list_dir(ExplorerListDirInput {
            project_root: root.clone(),
            dir_path: root,
        })
        .unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|e| e.name == "a.txt"));
        assert!(entries.iter().any(|e| e.name == "src" && e.is_dir));
    }
}
