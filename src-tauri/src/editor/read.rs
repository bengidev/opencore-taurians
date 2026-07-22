use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use crate::path_scope::ensure_under_root;

pub const MAX_EDITOR_FILE_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorReadInput {
    pub project_root: String,
    pub path: String,
}

pub fn editor_read_file(input: EditorReadInput) -> Result<String, EditorError> {
    let path = ensure_under_root(Path::new(&input.project_root), Path::new(&input.path))
        .map_err(|_| EditorError::OutsideProject(input.path.clone()))?;

    if !path.exists() {
        return Err(EditorError::NotFound(input.path));
    }

    if !path.is_file() {
        return Err(EditorError::NotAFile(input.path));
    }

    let metadata = fs::metadata(&path)?;
    if metadata.len() > MAX_EDITOR_FILE_BYTES {
        return Err(EditorError::TooLarge(input.path));
    }

    let bytes = fs::read(&path)?;
    if bytes.contains(&0) {
        return Err(EditorError::BinaryOrNonUtf8(input.path));
    }

    String::from_utf8(bytes).map_err(|_| EditorError::BinaryOrNonUtf8(input.path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn reads_utf8_file_under_root() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("a.txt");
        fs::write(&file, "hello").unwrap();
        let content = editor_read_file(EditorReadInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
        })
        .unwrap();
        assert_eq!(content, "hello");
    }

    #[test]
    fn rejects_outside_project() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("opencore-editor-outside.txt");
        let _ = fs::write(&outside, "x");
        let result = editor_read_file(EditorReadInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: outside.to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(EditorError::OutsideProject(_))));
    }

    #[test]
    fn rejects_missing_file() {
        let dir = tempdir().unwrap();
        let missing = dir.path().join("nope.txt");
        let result = editor_read_file(EditorReadInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: missing.to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(EditorError::NotFound(_))));
    }

    #[test]
    fn rejects_directory() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("src");
        fs::create_dir(&sub).unwrap();
        let result = editor_read_file(EditorReadInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: sub.to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(EditorError::NotAFile(_))));
    }

    #[test]
    fn rejects_binary_nul() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("bin.dat");
        fs::write(&file, b"a\0b").unwrap();
        let result = editor_read_file(EditorReadInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(EditorError::BinaryOrNonUtf8(_))));
    }

    #[test]
    fn rejects_oversize() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("big.txt");
        let data = vec![b'a'; (MAX_EDITOR_FILE_BYTES as usize) + 1];
        fs::write(&file, &data).unwrap();
        let result = editor_read_file(EditorReadInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(EditorError::TooLarge(_))));
    }
}
