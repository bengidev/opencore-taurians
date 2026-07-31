#![allow(dead_code)] // Provider release orchestration behind GIT_SUITE_RELEASE_ENABLED; provider mappings are test-covered.
use serde::{Deserialize, Serialize};

use crate::provider::contracts::ProviderKind;
use crate::provider::remote::{ProviderError, ProviderRelease};
use crate::provider::transport::ProviderTransport;

// ---------- Tauri command input/output types ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderReleaseInput {
    pub kind: ProviderKind,
    pub organization: Option<String>,
    pub owner: String,
    pub repo: String,
    pub tag_name: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub draft: bool,
    pub prerelease: bool,
    pub token: String,
}

/// Create a release on the given provider using the provider's native API.
///
/// Tokens are passed per-operation and never stored.
pub async fn create_provider_release(
    input: ProviderReleaseInput,
) -> Result<ProviderRelease, ProviderError> {
    match input.kind {
        ProviderKind::Github => create_github_release(&input).await,
        ProviderKind::Gitlab => create_gitlab_release(&input).await,
        ProviderKind::Bitbucket => create_bitbucket_release(&input).await,
        ProviderKind::AzureDevops => create_azure_release(&input).await,
    }
}

// ---------- GitHub ----------

async fn create_github_release(
    input: &ProviderReleaseInput,
) -> Result<ProviderRelease, ProviderError> {
    let transport = ProviderTransport::new("api.github.com", "https://api.github.com")
        .map_err(|e| ProviderError::NetworkError { message: e })?
        .with_token(&input.token);

    #[derive(Debug, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct GitHubReleaseRequest {
        tag_name: String,
        name: String,
        body: String,
        draft: bool,
        prerelease: bool,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GitHubReleaseResponse {
        id: u64,
        tag_name: String,
        name: Option<String>,
        body: Option<String>,
        draft: bool,
        prerelease: bool,
        html_url: String,
        created_at: Option<String>,
    }

    let body = serde_json::to_string(&GitHubReleaseRequest {
        tag_name: input.tag_name.clone(),
        name: input.name.clone().unwrap_or_else(|| input.tag_name.clone()),
        body: input.description.clone().unwrap_or_default(),
        draft: input.draft,
        prerelease: input.prerelease,
    })
    .map_err(|e| ProviderError::ProviderError {
        message: e.to_string(),
    })?;

    let path = format!("/repos/{}/{}/releases", input.owner, input.repo);
    let response: GitHubReleaseResponse = transport.post_json(&path, &body).await?;

    Ok(ProviderRelease {
        id: response.id.to_string(),
        tag_name: response.tag_name,
        name: response.name,
        description: response.body,
        draft: response.draft,
        prerelease: response.prerelease,
        html_url: response.html_url,
        created_at: response.created_at,
    })
}

// ---------- GitLab ----------

async fn create_gitlab_release(
    input: &ProviderReleaseInput,
) -> Result<ProviderRelease, ProviderError> {
    let transport = ProviderTransport::new("gitlab.com", "https://gitlab.com/api/v4")
        .map_err(|e| ProviderError::NetworkError { message: e })?
        .with_token(&input.token);

    #[derive(Debug, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct GitLabReleaseRequest {
        tag_name: String,
        name: String,
        description: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GitLabReleaseResponse {
        tag_name: String,
        name: Option<String>,
        description: Option<String>,
        commit_path: Option<String>,
        created_at: Option<String>,
    }

    let body = serde_json::to_string(&GitLabReleaseRequest {
        tag_name: input.tag_name.clone(),
        name: input.name.clone().unwrap_or_else(|| input.tag_name.clone()),
        description: input.description.clone().unwrap_or_default(),
    })
    .map_err(|e| ProviderError::ProviderError {
        message: e.to_string(),
    })?;

    // URL-encode project path: owner/repo -> owner%2Frepo
    let project_path = format!("{}%2F{}", input.owner, input.repo);
    let path = format!("/projects/{}/releases", project_path);
    let response: GitLabReleaseResponse = transport.post_json(&path, &body).await?;

    // GitLab releases don't have an id field in the same way — use tag_name
    // and construct the URL
    let encoded_path = format!("{}/{}", input.owner, input.repo);
    let html_url = format!(
        "https://gitlab.com/{}/-/releases/{}",
        encoded_path, response.tag_name
    );

    Ok(ProviderRelease {
        id: response.tag_name.clone(),
        tag_name: response.tag_name,
        name: response.name,
        description: response.description,
        draft: false,
        prerelease: false,
        html_url,
        created_at: response.created_at,
    })
}

// ---------- Bitbucket ----------

async fn create_bitbucket_release(
    input: &ProviderReleaseInput,
) -> Result<ProviderRelease, ProviderError> {
    // Bitbucket Cloud doesn't have a first-class "releases" API endpoint.
    // Releases are modeled as tags with Downloads attachments.
    // For now, return a meaningful error recommending the tag-based workflow.
    //
    // In a future iteration, this can push lightweight/annotated tags via
    // the Git Ref API and attach artifacts via the Downloads API.

    Err(ProviderError::ProviderError {
        message: format!(
            "Bitbucket Cloud does not have a native releases API. \
             Create a tag '{}' and attach binaries via the Bitbucket Downloads UI at \
             https://bitbucket.org/{}/{}/downloads/",
            input.tag_name, input.owner, input.repo,
        ),
    })
}

// ---------- Azure DevOps ----------

async fn create_azure_release(
    input: &ProviderReleaseInput,
) -> Result<ProviderRelease, ProviderError> {
    let organization =
        input
            .organization
            .as_deref()
            .ok_or_else(|| ProviderError::ProviderError {
                message: "Azure DevOps releases require an organization name".into(),
            })?;

    let _organization = organization;
    let _token = &input.token;
    // Azure DevOps uses "Release" pipelines, not a REST releases endpoint.
    // The git refs API can create tags, but actual release management requires
    // the Azure Pipelines API which is workflow-dependent.
    //
    // For now, return a descriptive error with instructions.

    let project = &input.repo;
    // A full release pipeline would use the Azure Pipelines Runs API.
    // Since we can't easily get the target commit OID from this context,
    // return a descriptive error with instructions.

    Err(ProviderError::ProviderError {
        message: format!(
            "Azure DevOps releases are managed through Azure Pipelines. \
             To create a release for '{org}/{project}': \
             set up a release pipeline at https://dev.azure.com/{org}/{project}/_release \
             or push a tag '{tag}' with git push origin {tag}.",
            org = organization,
            project = project,
            tag = input.tag_name,
        ),
    })
}

// ---------- Release capability query ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderReleaseCapability {
    pub kind: ProviderKind,
    pub supports_native_releases: bool,
    pub description: String,
}

/// Return the release capabilities for each provider.
pub fn release_capabilities() -> Vec<ProviderReleaseCapability> {
    vec![
        ProviderReleaseCapability {
            kind: ProviderKind::Github,
            supports_native_releases: true,
            description:
                "GitHub Releases with release notes, draft/pre-release flags, and asset uploads"
                    .into(),
        },
        ProviderReleaseCapability {
            kind: ProviderKind::Gitlab,
            supports_native_releases: true,
            description: "GitLab Releases linked to tags with release notes".into(),
        },
        ProviderReleaseCapability {
            kind: ProviderKind::Bitbucket,
            supports_native_releases: false,
            description: "Bitbucket Cloud uses tag-based releases with Downloads attachments"
                .into(),
        },
        ProviderReleaseCapability {
            kind: ProviderKind::AzureDevops,
            supports_native_releases: false,
            description: "Azure DevOps uses Azure Pipelines for release management".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_release_capabilities_cover_all_providers() {
        let caps = release_capabilities();
        assert_eq!(caps.len(), 4);
        // GitHub and GitLab support native releases
        let gh = caps
            .iter()
            .find(|c| c.kind == ProviderKind::Github)
            .unwrap();
        assert!(gh.supports_native_releases);
        let gl = caps
            .iter()
            .find(|c| c.kind == ProviderKind::Gitlab)
            .unwrap();
        assert!(gl.supports_native_releases);
        // Bitbucket and Azure do not
        let bb = caps
            .iter()
            .find(|c| c.kind == ProviderKind::Bitbucket)
            .unwrap();
        assert!(!bb.supports_native_releases);
        let az = caps
            .iter()
            .find(|c| c.kind == ProviderKind::AzureDevops)
            .unwrap();
        assert!(!az.supports_native_releases);
    }

    #[test]
    fn test_bitbucket_release_returns_provider_error() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let input = ProviderReleaseInput {
            kind: ProviderKind::Bitbucket,
            organization: None,
            owner: "owner".into(),
            repo: "repo".into(),
            tag_name: "v1.0.0".into(),
            name: Some("v1.0.0".into()),
            description: None,
            draft: false,
            prerelease: false,
            token: "test-token".into(),
        };
        let result = rt.block_on(create_bitbucket_release(&input));
        assert!(result.is_err());
        if let Err(e) = result {
            let msg = e.message();
            assert!(msg.contains("Bitbucket Cloud"));
            assert!(msg.contains("tag"));
        }
    }

    #[test]
    fn test_azure_release_requires_organization() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let input = ProviderReleaseInput {
            kind: ProviderKind::AzureDevops,
            organization: None,
            owner: "owner".into(),
            repo: "repo".into(),
            tag_name: "v1.0.0".into(),
            name: Some("v1.0.0".into()),
            description: None,
            draft: false,
            prerelease: false,
            token: "test-token".into(),
        };
        let result = rt.block_on(create_azure_release(&input));
        assert!(result.is_err());
    }
}
