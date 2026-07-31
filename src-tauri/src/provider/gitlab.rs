#![allow(dead_code)] // Provider client scaffolding: DTOs and HTTP flow behind GIT_SUITE_RELEASE_ENABLED; mapper fns are test-covered.
use serde::Deserialize;

use crate::provider::remote::{
    PaginatedResult, ProviderError, ProviderPrState, ProviderPullRequest, ProviderRepository,
};
use crate::provider::transport::ProviderTransport;

// ---------- GitLab API v4 internal deserialization structs ----------

#[derive(Debug, Clone, Deserialize)]
struct GitLabNamespace {
    path: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GitLabProject {
    id: u64,
    name: String,
    path_with_namespace: String,
    description: Option<String>,
    default_branch: Option<String>,
    visibility: String,
    http_url_to_repo: String,
    web_url: String,
    namespace: GitLabNamespace,
    updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct GitLabAuthor {
    username: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GitLabMR {
    id: u64,
    iid: u64,
    title: String,
    description: Option<String>,
    state: String,
    source_branch: String,
    target_branch: String,
    web_url: String,
    author: Option<GitLabAuthor>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct GitLabCreateProjectRequest {
    name: String,
    description: Option<String>,
    visibility: String,
    initialize_with_readme: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
struct GitLabCreateMRRequest {
    title: String,
    description: Option<String>,
    source_branch: String,
    target_branch: String,
}

// ---------- GitLab Client ----------

pub struct GitLabClient {
    transport: ProviderTransport,
}

impl GitLabClient {
    pub fn new(token: &str) -> Result<Self, ProviderError> {
        let transport = ProviderTransport::new("gitlab.com", "https://gitlab.com/api/v4")
            .map_err(|msg| ProviderError::ProviderError { message: msg })?
            .with_token(token);
        Ok(Self { transport })
    }

    // ---- Repositories ----

    pub async fn list_repositories(
        &self,
        page: u32,
        per_page: u32,
    ) -> Result<PaginatedResult<ProviderRepository>, ProviderError> {
        let path = format!(
            "/projects?membership=true&page={}&per_page={}",
            page, per_page
        );
        let projects: Vec<GitLabProject> = self.transport.get_json(&path).await?;
        let has_more = projects.len() == per_page as usize;
        let items: Vec<ProviderRepository> = projects.into_iter().map(map_gitlab_project).collect();

        Ok(PaginatedResult {
            items,
            total: None,
            has_more,
            next_cursor: if has_more {
                Some((page + 1).to_string())
            } else {
                None
            },
        })
    }

    pub async fn get_repository(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<ProviderRepository, ProviderError> {
        let encoded_path = urlencoding(owner, repo);
        let path = format!("/projects/{}", encoded_path);
        let project: GitLabProject = self.transport.get_json(&path).await?;
        Ok(map_gitlab_project(project))
    }

    pub async fn create_repository(
        &self,
        name: &str,
        description: Option<&str>,
        private: bool,
    ) -> Result<ProviderRepository, ProviderError> {
        let body = GitLabCreateProjectRequest {
            name: name.to_string(),
            description: description.map(|d| d.to_string()),
            visibility: if private {
                "private".to_string()
            } else {
                "public".to_string()
            },
            initialize_with_readme: true,
        };
        let body_str = serde_json::to_string(&body).map_err(|e| ProviderError::ProviderError {
            message: format!("Failed to serialize create project request: {}", e),
        })?;
        let project: GitLabProject = self.transport.post_json("/projects", &body_str).await?;
        Ok(map_gitlab_project(project))
    }

    // ---- Merge Requests (Pull Requests) ----

    pub async fn list_pull_requests(
        &self,
        owner: &str,
        repo: &str,
        state: Option<&str>,
        page: u32,
        per_page: u32,
    ) -> Result<PaginatedResult<ProviderPullRequest>, ProviderError> {
        let encoded_path = urlencoding(owner, repo);
        let mut path = format!(
            "/projects/{}/merge_requests?page={}&per_page={}",
            encoded_path, page, per_page
        );
        if let Some(s) = state {
            path.push_str(&format!("&state={}", s));
        }
        let mrs: Vec<GitLabMR> = self.transport.get_json(&path).await?;
        let has_more = mrs.len() == per_page as usize;
        let items: Vec<ProviderPullRequest> = mrs.into_iter().map(map_gitlab_mr).collect();

        Ok(PaginatedResult {
            items,
            total: None,
            has_more,
            next_cursor: if has_more {
                Some((page + 1).to_string())
            } else {
                None
            },
        })
    }

    pub async fn get_pull_request(
        &self,
        owner: &str,
        repo: &str,
        mr_iid: u64,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let encoded_path = urlencoding(owner, repo);
        let path = format!("/projects/{}/merge_requests/{}", encoded_path, mr_iid);
        let mr: GitLabMR = self.transport.get_json(&path).await?;
        Ok(map_gitlab_mr(mr))
    }

    pub async fn create_pull_request(
        &self,
        owner: &str,
        repo: &str,
        title: &str,
        description: Option<&str>,
        source_branch: &str,
        target_branch: &str,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let encoded_path = urlencoding(owner, repo);
        let path = format!("/projects/{}/merge_requests", encoded_path);
        let body = GitLabCreateMRRequest {
            title: title.to_string(),
            description: description.map(|d| d.to_string()),
            source_branch: source_branch.to_string(),
            target_branch: target_branch.to_string(),
        };
        let body_str = serde_json::to_string(&body).map_err(|e| ProviderError::ProviderError {
            message: format!("Failed to serialize create MR request: {}", e),
        })?;
        let mr: GitLabMR = self.transport.post_json(&path, &body_str).await?;
        Ok(map_gitlab_mr(mr))
    }
}

// ---------- Mapping helpers ----------

fn urlencoding(owner: &str, repo: &str) -> String {
    // GitLab API uses URL-encoded project path: owner/repo → owner%2Frepo
    format!("{}%2F{}", owner, repo)
}

fn map_gitlab_project(p: GitLabProject) -> ProviderRepository {
    ProviderRepository {
        id: p.id.to_string(),
        name: p.name,
        full_name: p.path_with_namespace,
        description: p.description,
        default_branch: p.default_branch,
        private: p.visibility == "private",
        clone_url: p.http_url_to_repo,
        html_url: p.web_url,
        owner: p.namespace.path,
        updated_at: p.updated_at,
    }
}

fn map_gitlab_mr(mr: GitLabMR) -> ProviderPullRequest {
    ProviderPullRequest {
        id: mr.id.to_string(),
        number: mr.iid,
        title: mr.title,
        description: mr.description,
        state: match mr.state.as_str() {
            "opened" => ProviderPrState::Open,
            "merged" => ProviderPrState::Merged,
            "locked" | "closed" => ProviderPrState::Closed,
            _ => ProviderPrState::Closed,
        },
        source_branch: mr.source_branch,
        target_branch: mr.target_branch,
        html_url: mr.web_url,
        author: mr.author.map(|a| a.username),
        created_at: mr.created_at,
        updated_at: mr.updated_at,
    }
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_gitlab_project_to_provider() {
        let project = GitLabProject {
            id: 12345,
            name: "my-repo".to_string(),
            path_with_namespace: "mygroup/my-repo".to_string(),
            description: Some("A test repo".to_string()),
            default_branch: Some("main".to_string()),
            visibility: "public".to_string(),
            http_url_to_repo: "https://gitlab.com/mygroup/my-repo.git".to_string(),
            web_url: "https://gitlab.com/mygroup/my-repo".to_string(),
            namespace: GitLabNamespace {
                path: "mygroup".to_string(),
            },
            updated_at: Some("2024-01-15T10:30:00Z".to_string()),
        };

        let repo = map_gitlab_project(project);

        assert_eq!(repo.id, "12345");
        assert_eq!(repo.name, "my-repo");
        assert_eq!(repo.full_name, "mygroup/my-repo");
        assert_eq!(repo.description, Some("A test repo".to_string()));
        assert_eq!(repo.default_branch, Some("main".to_string()));
        assert!(!repo.private, "public project should have private=false");
        assert_eq!(repo.clone_url, "https://gitlab.com/mygroup/my-repo.git");
        assert_eq!(repo.html_url, "https://gitlab.com/mygroup/my-repo");
        assert_eq!(repo.owner, "mygroup");
        assert_eq!(repo.updated_at, Some("2024-01-15T10:30:00Z".to_string()));
    }

    #[test]
    fn test_map_gitlab_mr_to_provider() {
        let mr = GitLabMR {
            id: 999,
            iid: 42,
            title: "Fix login bug".to_string(),
            description: Some("Fixes the login redirect loop".to_string()),
            state: "opened".to_string(),
            source_branch: "fix/login".to_string(),
            target_branch: "main".to_string(),
            web_url: "https://gitlab.com/mygroup/my-repo/-/merge_requests/42".to_string(),
            author: Some(GitLabAuthor {
                username: "devuser".to_string(),
            }),
            created_at: Some("2024-02-01T08:00:00Z".to_string()),
            updated_at: Some("2024-02-02T12:00:00Z".to_string()),
        };

        let pr = map_gitlab_mr(mr);

        assert_eq!(pr.id, "999");
        assert_eq!(pr.number, 42);
        assert_eq!(pr.title, "Fix login bug");
        assert_eq!(
            pr.description,
            Some("Fixes the login redirect loop".to_string())
        );
        assert_eq!(pr.state, ProviderPrState::Open);
        assert_eq!(pr.source_branch, "fix/login");
        assert_eq!(pr.target_branch, "main");
        assert_eq!(
            pr.html_url,
            "https://gitlab.com/mygroup/my-repo/-/merge_requests/42"
        );
        assert_eq!(pr.author, Some("devuser".to_string()));
        assert_eq!(pr.created_at, Some("2024-02-01T08:00:00Z".to_string()));
        assert_eq!(pr.updated_at, Some("2024-02-02T12:00:00Z".to_string()));
    }

    #[test]
    fn test_map_gitlab_mr_state_merged() {
        let mr = GitLabMR {
            id: 1,
            iid: 1,
            title: "Merged MR".to_string(),
            description: None,
            state: "merged".to_string(),
            source_branch: "feature/x".to_string(),
            target_branch: "main".to_string(),
            web_url: "https://gitlab.com/g/r/-/merge_requests/1".to_string(),
            author: None,
            created_at: None,
            updated_at: None,
        };
        let pr = map_gitlab_mr(mr);
        assert_eq!(pr.state, ProviderPrState::Merged);
    }

    #[test]
    fn test_map_gitlab_mr_state_closed() {
        let mr = GitLabMR {
            id: 2,
            iid: 2,
            title: "Closed MR".to_string(),
            description: None,
            state: "closed".to_string(),
            source_branch: "feature/y".to_string(),
            target_branch: "main".to_string(),
            web_url: "https://gitlab.com/g/r/-/merge_requests/2".to_string(),
            author: None,
            created_at: None,
            updated_at: None,
        };
        let pr = map_gitlab_mr(mr);
        assert_eq!(pr.state, ProviderPrState::Closed);
    }

    #[test]
    fn test_map_gitlab_mr_state_locked() {
        let mr = GitLabMR {
            id: 3,
            iid: 3,
            title: "Locked MR".to_string(),
            description: None,
            state: "locked".to_string(),
            source_branch: "feature/z".to_string(),
            target_branch: "main".to_string(),
            web_url: "https://gitlab.com/g/r/-/merge_requests/3".to_string(),
            author: None,
            created_at: None,
            updated_at: None,
        };
        let pr = map_gitlab_mr(mr);
        assert_eq!(pr.state, ProviderPrState::Closed);
    }

    #[test]
    fn test_urlencoding() {
        assert_eq!(urlencoding("mygroup", "my-repo"), "mygroup%2Fmy-repo");
    }
}
