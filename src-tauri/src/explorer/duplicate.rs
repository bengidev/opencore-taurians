use std::fs;
use std::io;
use std::path::Path;

use super::error::ExplorerError;
use super::list_dir::ExplorerEntry;
use crate::path_scope::ensure_under_root;
use super::trash::ExplorerPathInput;

/// Duplicate naming: `foo.txt` → `foo copy.txt`, `mydir` → `mydir copy`.
fn duplicate_name(file_name: &str, is_dir: bool) -> String {
    if is_dir {
        return format!("{file_name} copy");
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy())
        .unwrap_or_else(|| file_name.into());
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    format!("{stem} copy{ext}")
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

#[tauri::command]
pub fn explorer_duplicate(input: ExplorerPathInput) -> Result<ExplorerEntry, ExplorerError> {
    let source = ensure_under_root(Path::new(&input.project_root), Path::new(&input.path))
        .map_err(|_| ExplorerError::OutsideProject(input.path.clone()))?;
    if !source.exists() {
        return Err(ExplorerError::NotFound(input.path));
    }
    let is_dir = source.is_dir();
    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| ExplorerError::Invalid("invalid file name".into()))?;
    let parent = source
        .parent()
        .ok_or_else(|| ExplorerError::Invalid("no parent".into()))?;
    let dest_name = duplicate_name(file_name, is_dir);
    let dest = ensure_under_root(
        Path::new(&input.project_root),
        &parent.join(&dest_name),
    )
    .map_err(|_| ExplorerError::OutsideProject(dest_name.clone()))?;
    if dest.exists() {
        return Err(ExplorerError::AlreadyExists(
            dest.to_string_lossy().into_owned(),
        ));
    }
    if is_dir {
        copy_dir_recursive(&source, &dest)?;
    } else {
        fs::copy(&source, &dest)?;
    }
    Ok(ExplorerEntry {
        name: dest_name,
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
    fn duplicates_file_as_foo_copy_txt() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("foo.txt");
        fs::write(&file, "content").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let entry = explorer_duplicate(ExplorerPathInput {
            project_root: root,
            path: file.to_string_lossy().into_owned(),
        })
        .unwrap();
        assert_eq!(entry.name, "foo copy.txt");
        assert!(!entry.is_dir);
        assert!(file.exists());
        assert_eq!(
            fs::read_to_string(dir.path().join("foo copy.txt")).unwrap(),
            "content"
        );
    }

    #[test]
    fn duplicates_directory_recursively() {
        let dir = tempdir().unwrap();
        let nested = dir.path().join("src");
        fs::create_dir(&nested).unwrap();
        fs::write(nested.join("main.rs"), "fn main() {}").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let entry = explorer_duplicate(ExplorerPathInput {
            project_root: root,
            path: nested.to_string_lossy().into_owned(),
        })
        .unwrap();
        assert_eq!(entry.name, "src copy");
        assert!(entry.is_dir);
        assert!(nested.exists());
        assert!(dir.path().join("src copy").join("main.rs").exists());
    }

    #[test]
    fn rejects_path_outside_project() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("outside-dup-test.txt");
        fs::write(&outside, "x").unwrap();
        let root = dir.path().to_string_lossy().into_owned();
        let result = explorer_duplicate(ExplorerPathInput {
            project_root: root,
            path: outside.to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(ExplorerError::OutsideProject(_))));
        let _ = fs::remove_file(outside);
    }
}
