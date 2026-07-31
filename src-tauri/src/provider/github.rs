#![allow(dead_code)] // Provider client scaffolding: DTOs and HTTP flow behind GIT_SUITE_RELEASE_ENABLED; mapper fns are test-covered.
use crate::provider::remote::*;
use crate::provider::transport::ProviderTransport;
use serde::{Deserialize, Serialize};

// Internal deserialization structs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubRepo {
    id: u64,
    name: String,
    full_name: String,
    description: Option<String>,
    default_branch: Option<String>,
    private: bool,
    clone_url: String,
    html_url: String,
    owner: GitHubOwner,
    updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubOwner {
    login: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubPR {
    id: u64,
    number: u64,
    title: String,
    body: Option<String>,
    state: String,
    head: GitHubPRBranch,
    base: GitHubPRBranch,
    html_url: String,
    user: Option<GitHubOwner>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubPRBranch {
    #[serde(rename = "ref")]
    ref_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitHubCreateRepoRequest {
    name: String,
    description: String,
    private: bool,
    auto_init: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitHubCreatePRRequest {
    title: String,
    body: String,
    head: String,
    base: String,
}

pub struct GitHubClient {
    transport: ProviderTransport,
}

impl GitHubClient {
    pub fn new(token: &str) -> Result<Self, ProviderError> {
        let transport = ProviderTransport::new("api.github.com", "https://api.github.com")
            .map_err(|e| ProviderError::NetworkError { message: e })?
            .with_token(token);
        Ok(Self { transport })
    }

    fn map_repo(&self, r: GitHubRepo) -> ProviderRepository {
        ProviderRepository {
            id: r.id.to_string(),
            name: r.name,
            full_name: r.full_name,
            description: r.description,
            default_branch: r.default_branch,
            private: r.private,
            clone_url: r.clone_url,
            html_url: r.html_url,
            owner: r.owner.login,
            updated_at: r.updated_at,
        }
    }

    fn map_pr(&self, pr: GitHubPR) -> ProviderPullRequest {
        ProviderPullRequest {
            id: pr.id.to_string(),
            number: pr.number,
            title: pr.title,
            description: pr.body,
            state: match pr.state.as_str() {
                "open" => ProviderPrState::Open,
                "closed" => ProviderPrState::Closed,
                _ => ProviderPrState::Merged,
            },
            source_branch: pr.head.ref_name,
            target_branch: pr.base.ref_name,
            html_url: pr.html_url,
            author: pr.user.map(|u| u.login),
            created_at: pr.created_at,
            updated_at: pr.updated_at,
        }
    }

    pub fn with_token(mut self, token: &str) -> Self {
        self.transport = self.transport.with_token(token);
        self
    }

    pub async fn list_repositories(
        &self,
        page: u32,
        per_page: u32,
    ) -> Result<PaginatedResult<ProviderRepository>, ProviderError> {
        let path = format!(
            "/user/repos?page={}&per_page={}&sort=updated",
            page, per_page
        );
        let repos: Vec<GitHubRepo> = self.transport.get_json(&path).await?;
        let items: Vec<ProviderRepository> = repos.into_iter().map(|r| self.map_repo(r)).collect();
        Ok(PaginatedResult {
            has_more: items.len() == per_page as usize,
            items,
            total: None,
            next_cursor: None,
        })
    }

    pub async fn get_repository(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<ProviderRepository, ProviderError> {
        let path = format!("/repos/{}/{}", owner, repo);
        let r: GitHubRepo = self.transport.get_json(&path).await?;
        Ok(self.map_repo(r))
    }

    pub async fn create_repository(
        &self,
        name: &str,
        description: &str,
        private: bool,
    ) -> Result<ProviderRepository, ProviderError> {
        let body = serde_json::to_string(&GitHubCreateRepoRequest {
            name: name.to_string(),
            description: description.to_string(),
            private,
            auto_init: true,
        })
        .map_err(|e| ProviderError::ProviderError {
            message: e.to_string(),
        })?;
        let r: GitHubRepo = self.transport.post_json("/user/repos", &body).await?;
        Ok(self.map_repo(r))
    }

    pub async fn list_pull_requests(
        &self,
        owner: &str,
        repo: &str,
        state: &str,
        page: u32,
        per_page: u32,
    ) -> Result<PaginatedResult<ProviderPullRequest>, ProviderError> {
        let path = format!(
            "/repos/{}/{}/pulls?state={}&page={}&per_page={}",
            owner, repo, state, page, per_page
        );
        let prs: Vec<GitHubPR> = self.transport.get_json(&path).await?;
        let items: Vec<ProviderPullRequest> = prs.into_iter().map(|pr| self.map_pr(pr)).collect();
        Ok(PaginatedResult {
            has_more: items.len() == per_page as usize,
            items,
            total: None,
            next_cursor: None,
        })
    }

    pub async fn get_pull_request(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
        let pr: GitHubPR = self.transport.get_json(&path).await?;
        Ok(self.map_pr(pr))
    }

    pub async fn create_pull_request(
        &self,
        owner: &str,
        repo: &str,
        title: &str,
        description: &str,
        source_branch: &str,
        target_branch: &str,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let body = serde_json::to_string(&GitHubCreatePRRequest {
            title: title.to_string(),
            body: description.to_string(),
            head: source_branch.to_string(),
            base: target_branch.to_string(),
        })
        .map_err(|e| ProviderError::ProviderError {
            message: e.to_string(),
        })?;
        let path = format!("/repos/{}/{}/pulls", owner, repo);
        let pr: GitHubPR = self.transport.post_json(&path, &body).await?;
        Ok(self.map_pr(pr))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_github_repo_to_provider() {
        let client = GitHubClient::new("test-token").unwrap();
        let gh = GitHubRepo {
            id: 123,
            name: "my-repo".into(),
            full_name: "user/my-repo".into(),
            description: Some("A test repo".into()),
            default_branch: Some("main".into()),
            private: false,
            clone_url: "https://github.com/user/my-repo.git".into(),
            html_url: "https://github.com/user/my-repo".into(),
            owner: GitHubOwner {
                login: "user".into(),
            },
            updated_at: Some("2024-01-01T00:00:00Z".into()),
        };
        let result = client.map_repo(gh);
        assert_eq!(result.id, "123");
        assert_eq!(result.name, "my-repo");
        assert_eq!(result.full_name, "user/my-repo");
        assert_eq!(result.owner, "user");
        assert!(!result.private);
    }

    #[test]
    fn test_map_github_pr_to_provider() {
        let client = GitHubClient::new("test-token").unwrap();
        let pr = GitHubPR {
            id: 456,
            number: 1,
            title: "Fix bug".into(),
            body: Some("Fixes issue #1".into()),
            state: "open".into(),
            head: GitHubPRBranch {
                ref_name: "feature/fix".into(),
            },
            base: GitHubPRBranch {
                ref_name: "main".into(),
            },
            html_url: "https://github.com/user/repo/pull/1".into(),
            user: Some(GitHubOwner {
                login: "contributor".into(),
            }),
            created_at: Some("2024-01-01T00:00:00Z".into()),
            updated_at: None,
        };
        let result = client.map_pr(pr);
        assert_eq!(result.id, "456");
        assert_eq!(result.number, 1);
        assert_eq!(result.title, "Fix bug");
        assert_eq!(result.state, ProviderPrState::Open);
        assert_eq!(result.source_branch, "feature/fix");
        assert_eq!(result.target_branch, "main");
        assert_eq!(result.author, Some("contributor".into()));
    }
}
