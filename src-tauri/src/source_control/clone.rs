use crate::source_control::contracts::PublicSourceControlError;
use crate::source_control::process::{
    SourceControlCommandSpec, SourceControlExecutionPolicy, SourceControlProcess, SystemGitProcess,
};
use crate::source_control::scope_registry::SourceControlScopeRecord;
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::Path;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(300);
const LIMIT: usize = 256 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCloneInput {
    pub scope_id: String,
    pub url: String,
    pub destination_name: String,
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

fn validate_destination_name(name: &str) -> Result<(), PublicSourceControlError> {
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.contains('/')
        || name.contains('\\')
        || Path::new(name).is_absolute()
        || Path::new(name).components().any(|component| {
            matches!(
                component,
                std::path::Component::CurDir | std::path::Component::ParentDir
            )
        })
    {
        return Err(PublicSourceControlError::checkout_invalid(
            "clone",
            "Destination name must be one safe relative directory name.",
        ));
    }
    Ok(())
}

pub fn clone_repository(
    input: SourceControlCloneInput,
    parent: &SourceControlScopeRecord,
) -> Result<SourceControlCloneResult, PublicSourceControlError> {
    clone_repository_with(&SystemGitProcess, input, parent)
}

pub fn clone_repository_with(
    process: &impl SourceControlProcess,
    input: SourceControlCloneInput,
    parent: &SourceControlScopeRecord,
) -> Result<SourceControlCloneResult, PublicSourceControlError> {
    validate_clone_url(&input.url)?;
    validate_destination_name(&input.destination_name)?;

    let parent_path = parent.project_root.as_path();
    std::fs::create_dir_all(parent_path)
        .map_err(|_| PublicSourceControlError::process_failed("clone", true))?;
    let dest = parent_path.join(&input.destination_name);
    if dest.exists() {
        return Err(PublicSourceControlError::precondition_failed(
            "clone",
            "Destination directory already exists and is not empty.",
        ));
    }

    let staging = parent_path.join(format!(".clone-{}", uuid::Uuid::new_v4()));
    let mut args: Vec<&str> = vec!["clone", "--quiet"];
    if input.recurse_submodules {
        args.push("--recurse-submodules");
    }
    if let Some(branch) = &input.branch {
        args.push("--branch");
        args.push(branch);
    }
    args.push(&input.url);
    let staging_str = staging.to_string_lossy();
    args.push(staging_str.as_ref());

    let spec = SourceControlCommandSpec {
        checkout: parent_path.to_path_buf(),
        operation: "clone",
        args: args.iter().map(|s| OsString::from(*s)).collect(),
        timeout: TIMEOUT,
        stdout_limit: LIMIT,
        stderr_limit: LIMIT,
        policy: SourceControlExecutionPolicy::BackgroundNetwork,
    };
    match process.run(spec) {
        Ok(_) => {
            std::fs::rename(&staging, &dest).map_err(|_| {
                let _ = std::fs::remove_dir_all(&staging);
                PublicSourceControlError::process_failed("clone", false)
            })?;
            Ok(SourceControlCloneResult {
                path: dest.to_string_lossy().into_owned(),
                message: "Cloned successfully".into(),
            })
        }
        Err(error) => {
            let _ = std::fs::remove_dir_all(&staging);
            Err(error)
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
    #[test]
    fn rejects_unsafe_destination_names() {
        for name in ["", ".", "..", "../repo", "repo/name", "repo\\name", "/repo"] {
            assert!(
                validate_destination_name(name).is_err(),
                "accepted {name:?}"
            );
        }
        assert!(validate_destination_name("repo").is_ok());
    }
}
