#![allow(dead_code)] // Provider client scaffolding: DTOs and HTTP flow behind GIT_SUITE_RELEASE_ENABLED; mapper fns are test-covered.
use crate::provider::remote::*;
use crate::provider::transport::{ProviderHttpClient, ProviderTransport};
use serde::{Deserialize, Serialize};

// ---------- Internal Bitbucket API deserialization structs ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketRepo {
    uuid: String,
    name: String,
    full_name: String,
    description: Option<String>,
    #[serde(rename = "mainbranch")]
    mainbranch: Option<BitbucketBranch>,
    is_private: bool,
    links: BitbucketRepoLinks,
    owner: BitbucketOwner,
    updated_on: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketBranch {
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketOwner {
    display_name: Option<String>,
    username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketRepoLinks {
    clone: Vec<BitbucketCloneLink>,
    html: BitbucketHrefLink,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketCloneLink {
    name: String,
    href: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketHrefLink {
    href: String,
}

// ---------- Bitbucket PR structs ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketPR {
    id: u64,
    title: String,
    summary: Option<BitbucketPRSummary>,
    state: String,
    source: BitbucketPRBranch,
    destination: BitbucketPRBranch,
    links: BitbucketPRLinks,
    author: Option<BitbucketOwner>,
    created_on: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketPRSummary {
    raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketPRBranch {
    branch: BitbucketBranchName,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketBranchName {
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketPRLinks {
    html: BitbucketHrefLink,
}

// ---------- Bitbucket paginated list wrappers ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketRepoList {
    values: Vec<BitbucketRepo>,
    next: Option<String>,
    page: Option<u64>,
    size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketPRList {
    values: Vec<BitbucketPR>,
    next: Option<String>,
    page: Option<u64>,
    size: Option<u64>,
}

// ---------- Bitbucket create request structs ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketCreateRepoRequest {
    scm: String,
    description: String,
    is_private: bool,
    has_issues: bool,
    has_wiki: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketCreatePRRequest {
    title: String,
    description: String,
    source: BitbucketPRSource,
    destination: BitbucketPRSource,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketPRSource {
    branch: BitbucketBranchRef,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
struct BitbucketBranchRef {
    name: String,
}

// ---------- Client ----------

pub struct BitbucketClient {
    transport: ProviderHttpClient,
}

impl BitbucketClient {
    pub fn new(token: &str) -> Result<Self, ProviderError> {
        let transport =
            ProviderTransport::new("api.bitbucket.org", "https://api.bitbucket.org/2.0")
                .map_err(|e| ProviderError::NetworkError { message: e })?
                .with_token(token);
        Ok(Self {
            transport: ProviderHttpClient::from_provider_transport(transport),
        })
    }

    pub fn with_http_client(transport: ProviderHttpClient) -> Self {
        Self { transport }
    }

    // --- Mapping helpers ---

    fn map_repo(&self, r: BitbucketRepo) -> ProviderRepository {
        let clone_url = r
            .links
            .clone
            .iter()
            .find(|l| l.name == "https")
            .map(|l| l.href.clone())
            .unwrap_or_else(|| {
                r.links
                    .clone
                    .first()
                    .map(|l| l.href.clone())
                    .unwrap_or_default()
            });

        let owner = r
            .owner
            .display_name
            .or(r.owner.username)
            .unwrap_or_default();

        ProviderRepository {
            id: r.uuid,
            name: r.name,
            full_name: r.full_name,
            description: r.description,
            default_branch: r.mainbranch.map(|b| b.name),
            private: r.is_private,
            clone_url,
            html_url: r.links.html.href,
            owner,
            updated_at: r.updated_on,
        }
    }

    fn map_pr(&self, pr: BitbucketPR) -> ProviderPullRequest {
        ProviderPullRequest {
            id: pr.id.to_string(),
            number: pr.id,
            title: pr.title,
            description: pr.summary.map(|s| s.raw),
            state: match pr.state.as_str() {
                "OPEN" => ProviderPrState::Open,
                "MERGED" => ProviderPrState::Merged,
                _ => ProviderPrState::Closed,
            },
            source_branch: pr.source.branch.name,
            target_branch: pr.destination.branch.name,
            html_url: pr.links.html.href,
            author: pr.author.and_then(|a| a.display_name.or(a.username)),
            created_at: pr.created_on,
            updated_at: None,
        }
    }

    fn build_paginated_result<T, P>(
        &self,
        values: Vec<P>,
        next: Option<String>,
        size: Option<u64>,
        mapper: impl Fn(P) -> T,
    ) -> PaginatedResult<T> {
        let has_more = next.is_some();
        let next_cursor = next.as_ref().and_then(|url| {
            // Parse the page number from the next URL for cursor
            url.split("page=")
                .nth(1)
                .and_then(|s| s.split('&').next())
                .map(|s| s.to_string())
        });
        let items: Vec<T> = values.into_iter().map(mapper).collect();
        PaginatedResult {
            items,
            total: size,
            has_more,
            next_cursor,
        }
    }

    // --- Public API ---

    pub async fn list_repositories(
        &self,
        workspace: &str,
        page: u32,
        per_page: u32,
    ) -> Result<PaginatedResult<ProviderRepository>, ProviderError> {
        let path = format!(
            "/repositories/{}?page={}&pagelen={}",
            workspace, page, per_page
        );
        let list: BitbucketRepoList = self.transport.get_json(&path).await?;
        Ok(self.build_paginated_result(list.values, list.next, list.size, |r| self.map_repo(r)))
    }

    pub async fn get_repository(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<ProviderRepository, ProviderError> {
        let path = format!("/repositories/{}/{}", owner, repo);
        let r: BitbucketRepo = self.transport.get_json(&path).await?;
        Ok(self.map_repo(r))
    }

    pub async fn create_repository(
        &self,
        workspace: &str,
        repo_slug: &str,
        description: &str,
        private: bool,
    ) -> Result<ProviderRepository, ProviderError> {
        let body = serde_json::to_string(&BitbucketCreateRepoRequest {
            scm: "git".to_string(),
            description: description.to_string(),
            is_private: private,
            has_issues: false,
            has_wiki: false,
        })
        .map_err(|e| ProviderError::ProviderError {
            message: e.to_string(),
        })?;
        let path = format!("/repositories/{}/{}", workspace, repo_slug);
        let r: BitbucketRepo = self.transport.post_json(&path, &body).await?;
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
            "/repositories/{}/{}/pullrequests?state={}&page={}&pagelen={}",
            owner, repo, state, page, per_page
        );
        let list: BitbucketPRList = self.transport.get_json(&path).await?;
        Ok(self.build_paginated_result(list.values, list.next, list.size, |pr| self.map_pr(pr)))
    }

    pub async fn get_pull_request(
        &self,
        owner: &str,
        repo: &str,
        number: u64,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let path = format!("/repositories/{}/{}/pullrequests/{}", owner, repo, number);
        let pr: BitbucketPR = self.transport.get_json(&path).await?;
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
        let body = serde_json::to_string(&BitbucketCreatePRRequest {
            title: title.to_string(),
            description: description.to_string(),
            source: BitbucketPRSource {
                branch: BitbucketBranchRef {
                    name: source_branch.to_string(),
                },
            },
            destination: BitbucketPRSource {
                branch: BitbucketBranchRef {
                    name: target_branch.to_string(),
                },
            },
        })
        .map_err(|e| ProviderError::ProviderError {
            message: e.to_string(),
        })?;
        let path = format!("/repositories/{}/{}/pullrequests", owner, repo);
        let pr: BitbucketPR = self.transport.post_json(&path, &body).await?;
        Ok(self.map_pr(pr))
    }
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_map_bitbucket_repo_to_provider() {
        let client = BitbucketClient::new("test-token").unwrap();
        let repo = BitbucketRepo {
            uuid: "repo-uuid-123".into(),
            name: "my-repo".into(),
            full_name: "workspace/my-repo".into(),
            description: Some("A test repo".into()),
            mainbranch: Some(BitbucketBranch {
                name: "main".into(),
            }),
            is_private: false,
            links: BitbucketRepoLinks {
                clone: vec![
                    BitbucketCloneLink {
                        name: "https".into(),
                        href: "https://bitbucket.org/workspace/my-repo.git".into(),
                    },
                    BitbucketCloneLink {
                        name: "ssh".into(),
                        href: "git@bitbucket.org:workspace/my-repo.git".into(),
                    },
                ],
                html: BitbucketHrefLink {
                    href: "https://bitbucket.org/workspace/my-repo".into(),
                },
            },
            owner: BitbucketOwner {
                display_name: Some("Workspace User".into()),
                username: Some("workspace".into()),
            },
            updated_on: Some("2024-01-01T00:00:00Z".into()),
        };
        let result = client.map_repo(repo);
        assert_eq!(result.id, "repo-uuid-123");
        assert_eq!(result.name, "my-repo");
        assert_eq!(result.full_name, "workspace/my-repo");
        assert_eq!(result.description, Some("A test repo".into()));
        assert_eq!(result.default_branch, Some("main".into()));
        assert!(!result.private);
        assert_eq!(
            result.clone_url,
            "https://bitbucket.org/workspace/my-repo.git"
        );
        assert_eq!(result.html_url, "https://bitbucket.org/workspace/my-repo");
        assert_eq!(result.owner, "Workspace User");
        assert_eq!(result.updated_at, Some("2024-01-01T00:00:00Z".into()));
    }

    #[test]
    fn test_map_bitbucket_pr_to_provider() {
        let client = BitbucketClient::new("test-token").unwrap();
        let pr = BitbucketPR {
            id: 42,
            title: "Fix bug".into(),
            summary: Some(BitbucketPRSummary {
                raw: "Fixes issue #1".into(),
            }),
            state: "OPEN".into(),
            source: BitbucketPRBranch {
                branch: BitbucketBranchName {
                    name: "feature/fix".into(),
                },
            },
            destination: BitbucketPRBranch {
                branch: BitbucketBranchName {
                    name: "main".into(),
                },
            },
            links: BitbucketPRLinks {
                html: BitbucketHrefLink {
                    href: "https://bitbucket.org/workspace/my-repo/pull-requests/42".into(),
                },
            },
            author: Some(BitbucketOwner {
                display_name: Some("Contributor".into()),
                username: Some("contributor".into()),
            }),
            created_on: Some("2024-01-01T00:00:00Z".into()),
        };
        let result = client.map_pr(pr);
        assert_eq!(result.id, "42");
        assert_eq!(result.number, 42);
        assert_eq!(result.title, "Fix bug");
        assert_eq!(result.description, Some("Fixes issue #1".into()));
        assert_eq!(result.state, ProviderPrState::Open);
        assert_eq!(result.source_branch, "feature/fix");
        assert_eq!(result.target_branch, "main");
        assert_eq!(
            result.html_url,
            "https://bitbucket.org/workspace/my-repo/pull-requests/42"
        );
        assert_eq!(result.author, Some("Contributor".into()));
        assert_eq!(result.created_at, Some("2024-01-01T00:00:00Z".into()));
        assert_eq!(result.updated_at, None);
    }
}
