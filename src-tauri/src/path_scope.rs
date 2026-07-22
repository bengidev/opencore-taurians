use std::path::{Component, Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum PathScopeError {
    #[error("path escapes project root")]
    OutsideProject,
    #[error("invalid path")]
    Invalid,
}

pub fn normalize_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| lexically_normalize(path))
}

fn lexically_normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            component => normalized.push(component),
        }
    }
    normalized
}

pub fn ensure_under_root(project_root: &Path, target: &Path) -> Result<PathBuf, PathScopeError> {
    let root = normalize_path(project_root);
    let resolved = normalize_path(target);
    if !resolved.starts_with(&root) {
        return Err(PathScopeError::OutsideProject);
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn allows_child_path() {
        let dir = tempdir().unwrap();
        let child = dir.path().join("src");
        fs::create_dir(&child).unwrap();
        let result = ensure_under_root(dir.path(), &child);
        assert!(result.is_ok());
    }

    #[test]
    fn rejects_path_outside_root() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir();
        let result = ensure_under_root(dir.path(), &outside);
        assert!(matches!(result, Err(PathScopeError::OutsideProject)));
    }

    #[test]
    fn rejects_lexical_traversal_outside_root() {
        let dir = tempdir().unwrap();
        let traversal = dir.path().join("..").join("outside.txt");
        let result = ensure_under_root(dir.path(), &traversal);
        assert!(matches!(result, Err(PathScopeError::OutsideProject)));
    }
}
