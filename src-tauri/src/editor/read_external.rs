use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use super::read::MAX_EDITOR_FILE_BYTES;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorExternalReadInput {
    pub path: String,
}

#[tauri::command]
pub fn editor_read_external_file(input: EditorExternalReadInput) -> Result<String, EditorError> {
    let path = Path::new(&input.path);

    if !path.exists() {
        return Err(EditorError::NotFound(input.path));
    }
    if !path.is_file() {
        return Err(EditorError::NotAFile(input.path));
    }

    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_EDITOR_FILE_BYTES {
        return Err(EditorError::TooLarge(input.path));
    }

    let bytes = fs::read(path)?;
    if bytes.contains(&0) {
        return Err(EditorError::BinaryOrNonUtf8(input.path));
    }
    String::from_utf8(bytes).map_err(|_| EditorError::BinaryOrNonUtf8(input.path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn reads_file_outside_any_project() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("outside.txt");
        fs::write(&file, "hello-ext").unwrap();
        let content = editor_read_external_file(EditorExternalReadInput {
            path: file.to_string_lossy().into_owned(),
        })
        .unwrap();
        assert_eq!(content, "hello-ext");
    }

    #[test]
    fn rejects_directory() {
        let dir = tempdir().unwrap();
        let result = editor_read_external_file(EditorExternalReadInput {
            path: dir.path().to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(EditorError::NotAFile(_))));
    }

    #[test]
    fn rejects_missing() {
        let result = editor_read_external_file(EditorExternalReadInput {
            path: "/tmp/opencore-missing-external-read-xyz.txt".into(),
        });
        assert!(matches!(result, Err(EditorError::NotFound(_))));
    }
}
