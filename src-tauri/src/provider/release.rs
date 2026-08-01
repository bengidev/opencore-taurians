use serde::{Deserialize, Serialize};

use crate::provider::contracts::{ProviderKind, ProviderReleaseCapability};
use crate::provider::remote::{ProviderError, ProviderRelease};
use crate::provider::transport::{ProviderHttpClient, ProviderTransport};

pub struct ProviderReleaseRequest {
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
    pub http: Option<ProviderHttpClient>,
}

pub async fn create_provider_release(
    input: ProviderReleaseRequest,
) -> Result<ProviderRelease, ProviderError> {
    match input.kind {
        ProviderKind::Github => create_github_release(&input).await,
        ProviderKind::Gitlab => create_gitlab_release(&input).await,
        ProviderKind::Bitbucket => create_bitbucket_release(&input).await,
        ProviderKind::AzureDevops => create_azure_release(&input).await,
    }
}

fn github_transport(input: &ProviderReleaseRequest) -> Result<ProviderHttpClient, ProviderError> {
    if let Some(http) = &input.http {
        return Ok(http.clone());
    }
    let transport = ProviderTransport::new("api.github.com", "https://api.github.com")
        .map_err(|e| ProviderError::NetworkError { message: e })?
        .with_token(&input.token);
    Ok(ProviderHttpClient::from_provider_transport(transport))
}

fn gitlab_transport(input: &ProviderReleaseRequest) -> Result<ProviderHttpClient, ProviderError> {
    if let Some(http) = &input.http {
        return Ok(http.clone());
    }
    let transport = ProviderTransport::new("gitlab.com", "https://gitlab.com/api/v4")
        .map_err(|e| ProviderError::NetworkError { message: e })?
        .with_token(&input.token);
    Ok(ProviderHttpClient::from_provider_transport(transport))
}

async fn create_github_release(
    input: &ProviderReleaseRequest,
) -> Result<ProviderRelease, ProviderError> {
    let transport = github_transport(input)?;

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
        name: input
            .name
            .clone()
            .unwrap_or_else(|| input.tag_name.clone()),
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

async fn create_gitlab_release(
    input: &ProviderReleaseRequest,
) -> Result<ProviderRelease, ProviderError> {
    let transport = gitlab_transport(input)?;

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
        created_at: Option<String>,
    }

    let body = serde_json::to_string(&GitLabReleaseRequest {
        tag_name: input.tag_name.clone(),
        name: input
            .name
            .clone()
            .unwrap_or_else(|| input.tag_name.clone()),
        description: input.description.clone().unwrap_or_default(),
    })
    .map_err(|e| ProviderError::ProviderError {
        message: e.to_string(),
    })?;

    let project_path = format!("{}%2F{}", input.owner, input.repo);
    let path = format!("/projects/{}/releases", project_path);
    let response: GitLabReleaseResponse = transport.post_json(&path, &body).await?;

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

async fn create_bitbucket_release(
    input: &ProviderReleaseRequest,
) -> Result<ProviderRelease, ProviderError> {
    Err(ProviderError::ProviderError {
        message: format!(
            "Bitbucket Cloud does not have a native releases API. \
             Create a tag '{}' and attach binaries via the Bitbucket Downloads UI at \
             https://bitbucket.org/{}/{}/downloads/",
            input.tag_name, input.owner, input.repo,
        ),
    })
}

async fn create_azure_release(
    input: &ProviderReleaseRequest,
) -> Result<ProviderRelease, ProviderError> {
    let organization = input
        .organization
        .as_deref()
        .ok_or_else(|| ProviderError::ProviderError {
            message: "Azure DevOps releases require an organization name".into(),
        })?;

    let project = &input.repo;

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
    use crate::provider::transport::{FakeTransport, ProviderHttpMethod};

    #[test]
    fn test_release_capabilities_cover_all_providers() {
        let caps = release_capabilities();
        assert_eq!(caps.len(), 4);
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
        let input = ProviderReleaseRequest {
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
            http: None,
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
        let input = ProviderReleaseRequest {
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
            http: None,
        };
        let result = rt.block_on(create_azure_release(&input));
        assert!(result.is_err());
    }

    #[test]
    fn test_github_release_uses_fake_transport() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let fake = FakeTransport::new();
        fake.stub_json(
            ProviderHttpMethod::Post,
            "/repos/acme/app/releases",
            200,
            r#"{"id":99,"tagName":"v1.0.0","name":"v1.0.0","body":"notes","draft":false,"prerelease":false,"htmlUrl":"https://github.com/acme/app/releases/tag/v1.0.0","createdAt":"2024-01-01T00:00:00Z"}"#,
        );
        let http = ProviderHttpClient::new(
            std::sync::Arc::new(fake),
            "https://api.github.com",
            Some("Bearer test".into()),
        );
        let input = ProviderReleaseRequest {
            kind: ProviderKind::Github,
            organization: None,
            owner: "acme".into(),
            repo: "app".into(),
            tag_name: "v1.0.0".into(),
            name: Some("v1.0.0".into()),
            description: Some("notes".into()),
            draft: false,
            prerelease: false,
            token: "test-token".into(),
            http: Some(http),
        };
        let result = rt.block_on(create_github_release(&input)).unwrap();
        assert_eq!(result.id, "99");
        assert_eq!(result.tag_name, "v1.0.0");
    }
}
