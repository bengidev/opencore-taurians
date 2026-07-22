use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use crate::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorCreateInput {
    pub project_root: String,
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn editor_create_file(input: EditorCreateInput) -> Result<(), EditorError> {
    let path = ensure_under_root(Path::new(&input.project_root), Path::new(&input.path))
        .map_err(|_| EditorError::OutsideProject(input.path.clone()))?;

    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(EditorError::ParentNotFound(input.path));
        }
    }

    if path.exists() {
        if !path.is_file() {
            return Err(EditorError::NotAFile(input.path));
        }
    }

    fs::write(&path, input.content.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn creates_missing_file_when_parent_exists() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("new.txt");
        editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
            content: "hi".into(),
        })
        .unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "hi");
    }

    #[test]
    fn overwrites_existing_file() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("a.txt");
        fs::write(&file, "old").unwrap();
        editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
            content: "new".into(),
        })
        .unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new");
    }

    #[test]
    fn rejects_missing_parent() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("nope").join("a.txt");
        let result = editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
            content: "x".into(),
        });
        assert!(matches!(result, Err(EditorError::ParentNotFound(_))));
    }

    #[test]
    fn rejects_outside_project() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("opencore-editor-create-outside.txt");
        let result = editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: outside.to_string_lossy().into_owned(),
            content: "x".into(),
        });
        assert!(matches!(result, Err(EditorError::OutsideProject(_))));
    }

    #[test]
    fn rejects_directory_target() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        let result = editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: sub.to_string_lossy().into_owned(),
            content: "x".into(),
        });
        assert!(matches!(result, Err(EditorError::NotAFile(_))));
    }
}
