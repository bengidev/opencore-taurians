use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use crate::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorUnderRootInput {
    pub project_root: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorPathsInput {
    pub paths: Vec<String>,
}

#[tauri::command]
pub fn editor_is_under_root(input: EditorUnderRootInput) -> Result<bool, EditorError> {
    Ok(ensure_under_root(Path::new(&input.project_root), Path::new(&input.path)).is_ok())
}

#[tauri::command]
pub fn editor_paths_include_directory(input: EditorPathsInput) -> Result<bool, EditorError> {
    for path in &input.paths {
        let p = Path::new(path);
        if p.exists() && p.is_dir() {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn under_root_true_for_child() {
        let dir = tempdir().unwrap();
        let child = dir.path().join("a.txt");
        fs::write(&child, "x").unwrap();
        assert!(editor_is_under_root(EditorUnderRootInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: child.to_string_lossy().into_owned(),
        })
        .unwrap());
    }

    #[test]
    fn under_root_false_for_outside() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("opencore-under-root-outside.txt");
        let _ = fs::write(&outside, "x");
        assert!(!editor_is_under_root(EditorUnderRootInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: outside.to_string_lossy().into_owned(),
        })
        .unwrap());
    }

    #[test]
    fn paths_include_directory_detects_dir() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("f.txt");
        fs::write(&file, "x").unwrap();
        assert!(editor_paths_include_directory(EditorPathsInput {
            paths: vec![
                file.to_string_lossy().into_owned(),
                dir.path().to_string_lossy().into_owned(),
            ],
        })
        .unwrap());
    }

    #[test]
    fn paths_include_directory_false_for_files_only() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("f.txt");
        fs::write(&file, "x").unwrap();
        assert!(!editor_paths_include_directory(EditorPathsInput {
            paths: vec![file.to_string_lossy().into_owned()],
        })
        .unwrap());
    }
}
