use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use super::error::ExplorerError;
use super::list_dir::ExplorerEntry;
use crate::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerCopyPathsInput {
    pub project_root: String,
    pub target_dir: String,
    pub source_paths: Vec<String>,
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

fn copy_source_into_dir(source: &Path, target_dir: &Path) -> Result<PathBuf, ExplorerError> {
    if !source.exists() {
        return Err(ExplorerError::NotFound(
            source.to_string_lossy().into_owned(),
        ));
    }
    let file_name = source
        .file_name()
        .ok_or_else(|| ExplorerError::Invalid("invalid source path".into()))?;
    let dest = target_dir.join(file_name);
    if dest.exists() {
        return Err(ExplorerError::AlreadyExists(
            dest.to_string_lossy().into_owned(),
        ));
    }
    if source.is_dir() {
        copy_dir_recursive(source, &dest)?;
    } else {
        fs::copy(source, &dest)?;
    }
    Ok(dest)
}

#[tauri::command]
pub fn explorer_copy_paths(
    input: ExplorerCopyPathsInput,
) -> Result<Vec<ExplorerEntry>, ExplorerError> {
    let target_dir =
        ensure_under_root(Path::new(&input.project_root), Path::new(&input.target_dir))
            .map_err(|_| ExplorerError::OutsideProject(input.target_dir.clone()))?;
    if !target_dir.is_dir() {
        return Err(ExplorerError::NotFound(input.target_dir));
    }
    let mut entries = Vec::with_capacity(input.source_paths.len());
    for source_path in input.source_paths {
        let source = PathBuf::from(&source_path);
        let dest = copy_source_into_dir(&source, &target_dir)?;
        let is_dir = dest.is_dir();
        let name = dest
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| ExplorerError::Invalid("invalid destination name".into()))?
            .to_owned();
        entries.push(ExplorerEntry {
            name,
            path: dest.to_string_lossy().into_owned(),
            is_dir,
        });
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn copies_external_file_into_project_dir() {
        let project = tempdir().unwrap();
        let external = tempdir().unwrap();
        let source = external.path().join("dropped.txt");
        fs::write(&source, "dropped").unwrap();
        let root = project.path().to_string_lossy().into_owned();
        let entries = explorer_copy_paths(ExplorerCopyPathsInput {
            project_root: root.clone(),
            target_dir: root,
            source_paths: vec![source.to_string_lossy().into_owned()],
        })
        .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "dropped.txt");
        assert!(!entries[0].is_dir);
        assert_eq!(
            fs::read_to_string(project.path().join("dropped.txt")).unwrap(),
            "dropped"
        );
        assert!(source.exists());
    }

    #[test]
    fn copies_external_directory_into_project_dir() {
        let project = tempdir().unwrap();
        let external = tempdir().unwrap();
        let source = external.path().join("assets");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("logo.png"), "png").unwrap();
        let root = project.path().to_string_lossy().into_owned();
        let entries = explorer_copy_paths(ExplorerCopyPathsInput {
            project_root: root.clone(),
            target_dir: root,
            source_paths: vec![source.to_string_lossy().into_owned()],
        })
        .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "assets");
        assert!(entries[0].is_dir);
        assert!(project.path().join("assets").join("logo.png").exists());
    }

    #[test]
    fn rejects_target_dir_outside_project() {
        let project = tempdir().unwrap();
        let external = tempdir().unwrap();
        let source = external.path().join("dropped.txt");
        fs::write(&source, "dropped").unwrap();
        let root = project.path().to_string_lossy().into_owned();
        let outside = std::env::temp_dir().to_string_lossy().into_owned();
        let result = explorer_copy_paths(ExplorerCopyPathsInput {
            project_root: root,
            target_dir: outside,
            source_paths: vec![source.to_string_lossy().into_owned()],
        });
        assert!(matches!(result, Err(ExplorerError::OutsideProject(_))));
    }
}
