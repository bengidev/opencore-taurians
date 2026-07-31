use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess};
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(300);
const LIMIT: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCloneInput {
    pub url: String,
    pub destination: String,
    pub branch: Option<String>,
    pub recurse_submodules: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCloneResult {
    pub path: String,
    pub message: String,
}

fn validate_clone_url(url: &str) -> Result<(), PublicSourceControlError> {
    let lower = url.to_lowercase();
    if !lower.starts_with("https://") && !lower.contains("git@") && !lower.contains("ssh://") {
        return Err(PublicSourceControlError::checkout_invalid(
            "clone",
            "URL must be HTTPS, SSH, or git@ protocol.",
        ));
    }
    if lower.contains("file://")
        || lower.contains("ext::")
        || lower.contains("-c ")
        || lower.contains("--")
    {
        return Err(PublicSourceControlError::checkout_invalid(
            "clone",
            "URL contains unsafe protocol or control characters.",
        ));
    }
    Ok(())
}

pub fn clone_repository(input: SourceControlCloneInput) -> Result<SourceControlCloneResult, PublicSourceControlError> {
    validate_clone_url(&input.url)?;

    let dest = PathBuf::from(&input.destination);
    let parent = dest.parent().unwrap_or_else(|| Path::new("/"));
    std::fs::create_dir_all(parent).map_err(|_| PublicSourceControlError::process_failed("clone", true))?;

    if dest.exists() {
        return Err(PublicSourceControlError::precondition_failed(
            "clone",
            "Destination directory already exists and is not empty.",
        ));
    }

    let staging = parent.join(format!(".clone-{}", uuid::Uuid::new_v4()));
    let mut args: Vec<&str> = vec!["clone", "--quiet"];
    if input.recurse_submodules {
        args.push("--recurse-submodules");
    }
    if let Some(ref branch) = input.branch {
        args.push("--branch");
        args.push(branch);
    }
    args.push(&input.url);

    let staging_str = staging.to_string_lossy();
    let staging_ref = staging_str.as_ref();
    args.push(staging_ref);

    let spec = SourceControlCommandSpec {
        checkout: parent.to_path_buf(),
        operation: "clone",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: TIMEOUT,
        stdout_limit: LIMIT,
        stderr_limit: LIMIT,
        policy: SourceControlExecutionPolicy::BackgroundNetwork,
    };

    let result = SystemGitProcess.run(spec);
    match result {
        Ok(_) => {
            std::fs::rename(&staging, &dest).map_err(|_| {
                let _ = std::fs::remove_dir_all(&staging);
                PublicSourceControlError::process_failed("clone", false)
            })?;
            Ok(SourceControlCloneResult {
                path: input.destination.clone(),
                message: "Cloned successfully".into(),
            })
        }
        Err(e) => {
            let _ = std::fs::remove_dir_all(&staging);
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_urls() {
        assert!(validate_clone_url("file:///etc/passwd").is_err());
        assert!(validate_clone_url("https://github.com/user/repo.git").is_ok());
        assert!(validate_clone_url("git@github.com:user/repo.git").is_ok());
    }
}
