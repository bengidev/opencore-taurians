#![allow(dead_code)] // Provider client scaffolding: DTOs and HTTP flow behind GIT_SUITE_RELEASE_ENABLED; mapper fns are test-covered.
use crate::provider::remote::*;
use crate::provider::transport::{ProviderHttpClient, ProviderTransport};
use serde::{Deserialize, Serialize};

// ---------- Internal deserialization structs ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AzureRepo {
    id: String,
    name: String,
    default_branch: Option<String>,
    web_url: Option<String>,
    remote_url: Option<String>,
    project: AzureProject,
    last_updated: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AzureProject {
    id: String,
    name: String,
    visibility: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AzurePR {
    pull_request_id: u64,
    title: String,
    description: Option<String>,
    status: String,
    source_ref_name: String,
    target_ref_name: String,
    creation_date: Option<String>,
    created_by: Option<AzureUser>,
    repository: Option<AzureRepo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AzureUser {
    display_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AzureCreatePRRequest {
    title: String,
    description: String,
    source_ref_name: String,
    target_ref_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AzureListResponse<T> {
    value: Vec<T>,
    count: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AzureCreateRepoRequest {
    name: String,
}

// ---------- Client ----------

pub struct AzureDevOpsClient {
    transport: ProviderHttpClient,
    organization: String,
}

impl AzureDevOpsClient {
    pub fn new(organization: &str, token: &str) -> Result<Self, ProviderError> {
        let transport = ProviderTransport::new(
            "dev.azure.com",
            &format!("https://dev.azure.com/{}", organization),
        )
        .map_err(|e| ProviderError::NetworkError { message: e })?
        .with_basic_auth("", token);
        Ok(Self {
            transport: ProviderHttpClient::from_provider_transport(transport),
            organization: organization.to_string(),
        })
    }

    pub fn with_http_client(transport: ProviderHttpClient, organization: &str) -> Self {
        Self {
            transport,
            organization: organization.to_string(),
        }
    }

    // ---------- Mappers ----------

    fn map_repo(&self, r: AzureRepo) -> ProviderRepository {
        let project_name = r.project.name.clone();
        let repo_name = r.name.clone();
        let full_name = format!("{}/{}", project_name, repo_name);
        ProviderRepository {
            full_name,
            id: r.id,
            name: repo_name,
            description: None,
            default_branch: r.default_branch,
            private: true,
            clone_url: r.remote_url.unwrap_or_default(),
            html_url: r.web_url.unwrap_or_default(),
            owner: project_name,
            updated_at: r.last_updated,
        }
    }

    fn map_pr(&self, pr: AzurePR) -> ProviderPullRequest {
        let source_branch = pr
            .source_ref_name
            .strip_prefix("refs/heads/")
            .unwrap_or(&pr.source_ref_name)
            .to_string();
        let target_branch = pr
            .target_ref_name
            .strip_prefix("refs/heads/")
            .unwrap_or(&pr.target_ref_name)
            .to_string();

        let html_url = match &pr.repository {
            Some(repo) => {
                let base = repo.web_url.as_deref().unwrap_or("");
                format!("{}/pullrequest/{}", base, pr.pull_request_id)
            }
            None => format!(
                "https://dev.azure.com/{}/_git/pullrequest/{}",
                self.organization, pr.pull_request_id
            ),
        };

        ProviderPullRequest {
            id: pr.pull_request_id.to_string(),
            number: pr.pull_request_id,
            title: pr.title,
            description: pr.description,
            state: match pr.status.as_str() {
                "active" => ProviderPrState::Open,
                "completed" => ProviderPrState::Merged,
                "abandoned" => ProviderPrState::Closed,
                _ => ProviderPrState::Open,
            },
            source_branch,
            target_branch,
            html_url,
            author: pr.created_by.map(|u| u.display_name),
            created_at: pr.creation_date,
            updated_at: None,
        }
    }

    // ---------- API methods ----------

    pub async fn list_repositories(
        &self,
    ) -> Result<PaginatedResult<ProviderRepository>, ProviderError> {
        let path = "/_apis/git/repositories?api-version=7.1";
        let response: AzureListResponse<AzureRepo> = self.transport.get_json(path).await?;
        let items: Vec<ProviderRepository> = response
            .value
            .into_iter()
            .map(|r| self.map_repo(r))
            .collect();
        Ok(PaginatedResult {
            items,
            has_more: false,
            total: Some(response.count),
            next_cursor: None,
        })
    }

    pub async fn get_repository(
        &self,
        project: &str,
        repo_id: &str,
    ) -> Result<ProviderRepository, ProviderError> {
        let path = format!(
            "/{}/_apis/git/repositories/{}?api-version=7.1",
            project, repo_id
        );
        let r: AzureRepo = self.transport.get_json(&path).await?;
        Ok(self.map_repo(r))
    }

    pub async fn create_repository(
        &self,
        project: &str,
        name: &str,
    ) -> Result<ProviderRepository, ProviderError> {
        let body = serde_json::to_string(&AzureCreateRepoRequest {
            name: name.to_string(),
        })
        .map_err(|e| ProviderError::ProviderError {
            message: e.to_string(),
        })?;
        let path = format!("/{}/_apis/git/repositories?api-version=7.1", project);
        let r: AzureRepo = self.transport.post_json(&path, &body).await?;
        Ok(self.map_repo(r))
    }

    pub async fn list_pull_requests(
        &self,
        project: &str,
        state: &str,
    ) -> Result<PaginatedResult<ProviderPullRequest>, ProviderError> {
        let path = format!(
            "/{}/_apis/git/pullrequests?searchCriteria.status={}&api-version=7.1",
            project, state
        );
        let response: AzureListResponse<AzurePR> = self.transport.get_json(&path).await?;
        let items: Vec<ProviderPullRequest> = response
            .value
            .into_iter()
            .map(|pr| self.map_pr(pr))
            .collect();
        Ok(PaginatedResult {
            items,
            has_more: false,
            total: Some(response.count),
            next_cursor: None,
        })
    }

    pub async fn get_pull_request(
        &self,
        project: &str,
        pr_id: u64,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let path = format!(
            "/{}/_apis/git/pullrequests/{}?api-version=7.1",
            project, pr_id
        );
        let pr: AzurePR = self.transport.get_json(&path).await?;
        Ok(self.map_pr(pr))
    }

    pub async fn create_pull_request(
        &self,
        project: &str,
        title: &str,
        description: &str,
        source_branch: &str,
        target_branch: &str,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let body = serde_json::to_string(&AzureCreatePRRequest {
            title: title.to_string(),
            description: description.to_string(),
            source_ref_name: format!("refs/heads/{}", source_branch),
            target_ref_name: format!("refs/heads/{}", target_branch),
        })
        .map_err(|e| ProviderError::ProviderError {
            message: e.to_string(),
        })?;
        let path = format!("/{}/_apis/git/pullrequests?api-version=7.1", project);
        let pr: AzurePR = self.transport.post_json(&path, &body).await?;
        Ok(self.map_pr(pr))
    }
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_azure_repo_to_provider() {
        let client = AzureDevOpsClient::new("testorg", "test-token").unwrap();
        let az = AzureRepo {
            id: "abc-123-def".into(),
            name: "my-azure-repo".into(),
            default_branch: Some("main".into()),
            web_url: Some("https://dev.azure.com/testorg/MyProject/_git/my-azure-repo".into()),
            remote_url: Some(
                "https://testorg@dev.azure.com/testorg/MyProject/_git/my-azure-repo".into(),
            ),
            project: AzureProject {
                id: "proj-id-1".into(),
                name: "MyProject".into(),
                visibility: Some("private".into()),
            },
            last_updated: Some("2024-01-01T00:00:00Z".into()),
        };
        let result = client.map_repo(az);
        assert_eq!(result.id, "abc-123-def");
        assert_eq!(result.name, "my-azure-repo");
        assert_eq!(result.full_name, "MyProject/my-azure-repo");
        assert_eq!(result.default_branch, Some("main".into()));
        assert_eq!(result.owner, "MyProject");
        assert!(result.private);
        assert_eq!(result.updated_at, Some("2024-01-01T00:00:00Z".into()));
        assert!(result.html_url.contains("dev.azure.com"));
        assert!(result.clone_url.contains("dev.azure.com"));
    }

    #[test]
    fn test_map_azure_pr_state_mapping() {
        let client = AzureDevOpsClient::new("testorg", "test-token").unwrap();

        // Helper to build a PR with a given status
        let make_pr = |status: &str| AzurePR {
            pull_request_id: 42,
            title: "Test PR".into(),
            description: Some("PR description".into()),
            status: status.to_string(),
            source_ref_name: "refs/heads/feature/branch".into(),
            target_ref_name: "refs/heads/main".into(),
            creation_date: Some("2024-06-01T12:00:00Z".into()),
            created_by: Some(AzureUser {
                display_name: "Alice Developer".into(),
            }),
            repository: Some(AzureRepo {
                id: "repo-id".into(),
                name: "test-repo".into(),
                default_branch: Some("main".into()),
                web_url: Some("https://dev.azure.com/testorg/Project/_git/test-repo".into()),
                remote_url: None,
                project: AzureProject {
                    id: "proj-id".into(),
                    name: "Project".into(),
                    visibility: None,
                },
                last_updated: None,
            }),
        };

        // active -> Open
        let pr_active = make_pr("active");
        let mapped = client.map_pr(pr_active);
        assert_eq!(mapped.state, ProviderPrState::Open);
        assert_eq!(mapped.id, "42");
        assert_eq!(mapped.number, 42);
        assert_eq!(mapped.title, "Test PR");
        assert_eq!(mapped.source_branch, "feature/branch");
        assert_eq!(mapped.target_branch, "main");
        assert_eq!(mapped.author, Some("Alice Developer".into()));

        // completed -> Merged
        let pr_completed = make_pr("completed");
        let mapped = client.map_pr(pr_completed);
        assert_eq!(mapped.state, ProviderPrState::Merged);

        // abandoned -> Closed
        let pr_abandoned = make_pr("abandoned");
        let mapped = client.map_pr(pr_abandoned);
        assert_eq!(mapped.state, ProviderPrState::Closed);

        // unknown status defaults to Open
        let pr_unknown = make_pr("unknown");
        let mapped = client.map_pr(pr_unknown);
        assert_eq!(mapped.state, ProviderPrState::Open);
    }
}
