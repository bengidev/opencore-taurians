use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use crate::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorWriteInput {
    pub project_root: String,
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn editor_write_file(input: EditorWriteInput) -> Result<(), EditorError> {
    let path = ensure_under_root(Path::new(&input.project_root), Path::new(&input.path))
        .map_err(|_| EditorError::OutsideProject(input.path.clone()))?;

    if !path.exists() {
        return Err(EditorError::NotFound(input.path));
    }

    if !path.is_file() {
        return Err(EditorError::NotAFile(input.path));
    }

    fs::write(&path, input.content.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn writes_utf8_round_trip() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("a.txt");
        fs::write(&file, "old").unwrap();
        editor_write_file(EditorWriteInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
            content: "new".into(),
        })
        .unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new");
    }

    #[test]
    fn rejects_outside_project() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("opencore-editor-write-outside.txt");
        let _ = fs::write(&outside, "x");
        let result = editor_write_file(EditorWriteInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: outside.to_string_lossy().into_owned(),
            content: "y".into(),
        });
        assert!(matches!(result, Err(EditorError::OutsideProject(_))));
    }

    #[test]
    fn rejects_missing_file() {
        let dir = tempdir().unwrap();
        let missing = dir.path().join("nope.txt");
        let result = editor_write_file(EditorWriteInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: missing.to_string_lossy().into_owned(),
            content: "y".into(),
        });
        assert!(matches!(result, Err(EditorError::NotFound(_))));
    }
}
