use std::sync::Arc;

use crate::provider::azure::AzureDevOpsClient;
use crate::provider::bitbucket::BitbucketClient;
use crate::provider::contracts::ProviderReleaseCapability;
use crate::provider::contracts::{
    ProviderCreatePullRequestInput, ProviderCreateReleaseInput, ProviderCreateRepositoryInput,
    ProviderGetPullRequestInput, ProviderGetRepositoryInput, ProviderKind,
    ProviderListPullRequestsInput, ProviderListRepositoriesInput, StoredProviderCredential,
};
use crate::provider::github::GitHubClient;
use crate::provider::gitlab::GitLabClient;
use crate::provider::keychain::{
    KeychainCredentialStore, KeychainErrorKind, ProviderCredentialStore,
};
use crate::provider::release::{
    create_provider_release, release_capabilities, ProviderReleaseRequest,
};
use crate::provider::remote::{
    PaginatedResult, ProviderError, ProviderPullRequest, ProviderRelease, ProviderRepository,
};
use crate::provider::transport::{ProviderHttpClient, ProviderHttpTransport};

pub struct ProviderService {
    credentials: Arc<dyn ProviderCredentialStore>,
    transport: Option<Arc<dyn ProviderHttpTransport>>,
}

impl ProviderService {
    pub fn production() -> Self {
        Self {
            credentials: Arc::new(KeychainCredentialStore),
            transport: None,
        }
    }

    #[cfg(test)]
    pub fn for_test(
        credentials: Arc<dyn ProviderCredentialStore>,
        transport: Arc<dyn ProviderHttpTransport>,
    ) -> Self {
        Self {
            credentials,
            transport: Some(transport),
        }
    }

    fn load_credential(
        &self,
        credential_id: &str,
    ) -> Result<StoredProviderCredential, ProviderError> {
        self.credentials
            .read(credential_id)
            .map_err(map_credential_error)
    }

    fn require_azure_org(organization: &Option<String>) -> Result<&str, ProviderError> {
        organization
            .as_deref()
            .ok_or_else(|| ProviderError::ProviderError {
                message: "Azure DevOps operations require an organization name".into(),
            })
    }

    fn github_client(&self, token: &str) -> Result<GitHubClient, ProviderError> {
        if let Some(transport) = &self.transport {
            Ok(GitHubClient::with_http_client(ProviderHttpClient::new(
                transport.clone(),
                "https://api.github.com",
                Some(format!("Bearer {}", token)),
            )))
        } else {
            GitHubClient::new(token)
        }
    }

    fn gitlab_client(&self, token: &str) -> Result<GitLabClient, ProviderError> {
        if let Some(transport) = &self.transport {
            Ok(GitLabClient::with_http_client(ProviderHttpClient::new(
                transport.clone(),
                "https://gitlab.com/api/v4",
                Some(format!("Bearer {}", token)),
            )))
        } else {
            GitLabClient::new(token)
        }
    }

    fn bitbucket_client(&self, token: &str) -> Result<BitbucketClient, ProviderError> {
        if let Some(transport) = &self.transport {
            Ok(BitbucketClient::with_http_client(ProviderHttpClient::new(
                transport.clone(),
                "https://api.bitbucket.org/2.0",
                Some(format!("Bearer {}", token)),
            )))
        } else {
            BitbucketClient::new(token)
        }
    }

    fn azure_client(
        &self,
        organization: &str,
        token: &str,
    ) -> Result<AzureDevOpsClient, ProviderError> {
        if let Some(transport) = &self.transport {
            Ok(AzureDevOpsClient::with_http_client(
                ProviderHttpClient::new(
                    transport.clone(),
                    &format!("https://dev.azure.com/{}", organization),
                    Some(format!("Basic {}", base64_basic("", token))),
                ),
                organization,
            ))
        } else {
            AzureDevOpsClient::new(organization, token)
        }
    }

    fn release_http_client(
        &self,
        kind: &ProviderKind,
        token: &str,
        organization: Option<&str>,
    ) -> Result<Option<ProviderHttpClient>, ProviderError> {
        let Some(transport) = &self.transport else {
            return Ok(None);
        };
        let client = match kind {
            ProviderKind::Github => ProviderHttpClient::new(
                transport.clone(),
                "https://api.github.com",
                Some(format!("Bearer {}", token)),
            ),
            ProviderKind::Gitlab => ProviderHttpClient::new(
                transport.clone(),
                "https://gitlab.com/api/v4",
                Some(format!("Bearer {}", token)),
            ),
            ProviderKind::Bitbucket => ProviderHttpClient::new(
                transport.clone(),
                "https://api.bitbucket.org/2.0",
                Some(format!("Bearer {}", token)),
            ),
            ProviderKind::AzureDevops => {
                let org = organization.ok_or_else(|| ProviderError::ProviderError {
                    message: "Azure DevOps releases require an organization name".into(),
                })?;
                ProviderHttpClient::new(
                    transport.clone(),
                    &format!("https://dev.azure.com/{}", org),
                    Some(format!("Basic {}", base64_basic("", token))),
                )
            }
        };
        Ok(Some(client))
    }

    pub async fn list_repositories(
        &self,
        input: ProviderListRepositoriesInput,
    ) -> Result<PaginatedResult<ProviderRepository>, ProviderError> {
        let credential = self.load_credential(&input.credential_id)?;
        match credential.kind {
            ProviderKind::Github => {
                self.github_client(&credential.secret)?
                    .list_repositories(input.page, input.per_page)
                    .await
            }
            ProviderKind::Gitlab => {
                self.gitlab_client(&credential.secret)?
                    .list_repositories(input.page, input.per_page)
                    .await
            }
            ProviderKind::Bitbucket => {
                self.bitbucket_client(&credential.secret)?
                    .list_repositories(&credential.account, input.page, input.per_page)
                    .await
            }
            ProviderKind::AzureDevops => Err(ProviderError::ProviderError {
                message: "Azure DevOps list repositories requires organization-scoped credentials; use get/create with organization".into(),
            }),
        }
    }

    pub async fn get_repository(
        &self,
        input: ProviderGetRepositoryInput,
    ) -> Result<ProviderRepository, ProviderError> {
        let credential = self.load_credential(&input.credential_id)?;
        match credential.kind {
            ProviderKind::Github => {
                self.github_client(&credential.secret)?
                    .get_repository(&input.owner, &input.repo)
                    .await
            }
            ProviderKind::Gitlab => {
                self.gitlab_client(&credential.secret)?
                    .get_repository(&input.owner, &input.repo)
                    .await
            }
            ProviderKind::Bitbucket => {
                self.bitbucket_client(&credential.secret)?
                    .get_repository(&input.owner, &input.repo)
                    .await
            }
            ProviderKind::AzureDevops => {
                let org = Self::require_azure_org(&input.organization)?;
                self.azure_client(org, &credential.secret)?
                    .get_repository(&input.owner, &input.repo)
                    .await
            }
        }
    }

    pub async fn create_repository(
        &self,
        input: ProviderCreateRepositoryInput,
    ) -> Result<ProviderRepository, ProviderError> {
        let credential = self.load_credential(&input.credential_id)?;
        let description = input.description.unwrap_or_default();
        match credential.kind {
            ProviderKind::Github => {
                self.github_client(&credential.secret)?
                    .create_repository(&input.name, &description, input.private)
                    .await
            }
            ProviderKind::Gitlab => {
                self.gitlab_client(&credential.secret)?
                    .create_repository(&input.name, Some(description.as_str()), input.private)
                    .await
            }
            ProviderKind::Bitbucket => {
                self.bitbucket_client(&credential.secret)?
                    .create_repository(&input.owner, &input.name, &description, input.private)
                    .await
            }
            ProviderKind::AzureDevops => {
                let org = Self::require_azure_org(&input.organization)?;
                self.azure_client(org, &credential.secret)?
                    .create_repository(&input.owner, &input.name)
                    .await
            }
        }
    }

    pub async fn list_pull_requests(
        &self,
        input: ProviderListPullRequestsInput,
    ) -> Result<PaginatedResult<ProviderPullRequest>, ProviderError> {
        let credential = self.load_credential(&input.credential_id)?;
        match credential.kind {
            ProviderKind::Github => {
                self.github_client(&credential.secret)?
                    .list_pull_requests(
                        &input.owner,
                        &input.repo,
                        &input.state,
                        input.page,
                        input.per_page,
                    )
                    .await
            }
            ProviderKind::Gitlab => {
                self.gitlab_client(&credential.secret)?
                    .list_pull_requests(
                        &input.owner,
                        &input.repo,
                        Some(input.state.as_str()),
                        input.page,
                        input.per_page,
                    )
                    .await
            }
            ProviderKind::Bitbucket => {
                self.bitbucket_client(&credential.secret)?
                    .list_pull_requests(
                        &input.owner,
                        &input.repo,
                        &input.state,
                        input.page,
                        input.per_page,
                    )
                    .await
            }
            ProviderKind::AzureDevops => {
                let org = Self::require_azure_org(&input.organization)?;
                self.azure_client(org, &credential.secret)?
                    .list_pull_requests(&input.owner, &input.state)
                    .await
            }
        }
    }

    pub async fn get_pull_request(
        &self,
        input: ProviderGetPullRequestInput,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let credential = self.load_credential(&input.credential_id)?;
        match credential.kind {
            ProviderKind::Github => {
                self.github_client(&credential.secret)?
                    .get_pull_request(&input.owner, &input.repo, input.number)
                    .await
            }
            ProviderKind::Gitlab => {
                self.gitlab_client(&credential.secret)?
                    .get_pull_request(&input.owner, &input.repo, input.number)
                    .await
            }
            ProviderKind::Bitbucket => {
                self.bitbucket_client(&credential.secret)?
                    .get_pull_request(&input.owner, &input.repo, input.number)
                    .await
            }
            ProviderKind::AzureDevops => {
                let org = Self::require_azure_org(&input.organization)?;
                self.azure_client(org, &credential.secret)?
                    .get_pull_request(&input.owner, input.number)
                    .await
            }
        }
    }

    pub async fn create_pull_request(
        &self,
        input: ProviderCreatePullRequestInput,
    ) -> Result<ProviderPullRequest, ProviderError> {
        let credential = self.load_credential(&input.credential_id)?;
        let description = input.description.unwrap_or_default();
        match credential.kind {
            ProviderKind::Github => {
                self.github_client(&credential.secret)?
                    .create_pull_request(
                        &input.owner,
                        &input.repo,
                        &input.title,
                        &description,
                        &input.source_branch,
                        &input.target_branch,
                    )
                    .await
            }
            ProviderKind::Gitlab => {
                self.gitlab_client(&credential.secret)?
                    .create_pull_request(
                        &input.owner,
                        &input.repo,
                        &input.title,
                        Some(description.as_str()),
                        &input.source_branch,
                        &input.target_branch,
                    )
                    .await
            }
            ProviderKind::Bitbucket => {
                self.bitbucket_client(&credential.secret)?
                    .create_pull_request(
                        &input.owner,
                        &input.repo,
                        &input.title,
                        &description,
                        &input.source_branch,
                        &input.target_branch,
                    )
                    .await
            }
            ProviderKind::AzureDevops => {
                let org = Self::require_azure_org(&input.organization)?;
                self.azure_client(org, &credential.secret)?
                    .create_pull_request(
                        &input.owner,
                        &input.title,
                        &description,
                        &input.source_branch,
                        &input.target_branch,
                    )
                    .await
            }
        }
    }

    pub async fn create_release(
        &self,
        input: ProviderCreateReleaseInput,
    ) -> Result<ProviderRelease, ProviderError> {
        let credential = self.load_credential(&input.credential_id)?;
        let http = self.release_http_client(
            &credential.kind,
            &credential.secret,
            input.organization.as_deref(),
        )?;
        create_provider_release(ProviderReleaseRequest {
            kind: credential.kind,
            organization: input.organization,
            owner: input.owner,
            repo: input.repo,
            tag_name: input.tag_name,
            name: input.name,
            description: input.description,
            draft: input.draft,
            prerelease: input.prerelease,
            token: credential.secret,
            http,
        })
        .await
    }

    pub fn release_capabilities(&self) -> Vec<ProviderReleaseCapability> {
        release_capabilities()
    }
}

fn map_credential_error(error: crate::provider::keychain::PublicKeychainError) -> ProviderError {
    match error.kind {
        KeychainErrorKind::NotFound => ProviderError::AuthFailed {
            message: "Provider credential not found.".into(),
        },
        _ => ProviderError::ProviderError {
            message: error.message,
        },
    }
}

fn base64_basic(username: &str, password: &str) -> String {
    let mut buf = Vec::new();
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let input = format!("{}:{}", username, password);
    let bytes = input.as_bytes();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;
        buf.push(alphabet[((triple >> 18) & 0x3F) as usize]);
        buf.push(alphabet[((triple >> 12) & 0x3F) as usize]);
        if chunk.len() > 1 {
            buf.push(alphabet[((triple >> 6) & 0x3F) as usize]);
        } else {
            buf.push(b'=');
        }
        if chunk.len() > 2 {
            buf.push(alphabet[(triple & 0x3F) as usize]);
        } else {
            buf.push(b'=');
        }
    }
    String::from_utf8_lossy(&buf).into_owned()
}

fn production_service() -> ProviderService {
    ProviderService::production()
}

#[tauri::command]
pub async fn provider_list_repositories(
    input: ProviderListRepositoriesInput,
) -> Result<PaginatedResult<ProviderRepository>, ProviderError> {
    production_service().list_repositories(input).await
}

#[tauri::command]
pub async fn provider_get_repository(
    input: ProviderGetRepositoryInput,
) -> Result<ProviderRepository, ProviderError> {
    production_service().get_repository(input).await
}

#[tauri::command]
pub async fn provider_create_repository(
    input: ProviderCreateRepositoryInput,
) -> Result<ProviderRepository, ProviderError> {
    production_service().create_repository(input).await
}

#[tauri::command]
pub async fn provider_list_pull_requests(
    input: ProviderListPullRequestsInput,
) -> Result<PaginatedResult<ProviderPullRequest>, ProviderError> {
    production_service().list_pull_requests(input).await
}

#[tauri::command]
pub async fn provider_get_pull_request(
    input: ProviderGetPullRequestInput,
) -> Result<ProviderPullRequest, ProviderError> {
    production_service().get_pull_request(input).await
}

#[tauri::command]
pub async fn provider_create_pull_request(
    input: ProviderCreatePullRequestInput,
) -> Result<ProviderPullRequest, ProviderError> {
    production_service().create_pull_request(input).await
}

#[tauri::command]
pub async fn provider_create_release(
    input: ProviderCreateReleaseInput,
) -> Result<ProviderRelease, ProviderError> {
    production_service().create_release(input).await
}

#[tauri::command]
pub fn provider_release_capabilities() -> Vec<ProviderReleaseCapability> {
    production_service().release_capabilities()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::keychain::InMemoryCredentialStore;
    use crate::provider::remote::ProviderPrState;
    use crate::provider::transport::{FakeTransport, ProviderHttpMethod, ProviderHttpResponse};

    fn store_with_github_token(secret: &str) -> (Arc<InMemoryCredentialStore>, String) {
        let store = Arc::new(InMemoryCredentialStore::new());
        let credential_id = "cred-github".to_string();
        store
            .save(
                &credential_id,
                &StoredProviderCredential {
                    kind: ProviderKind::Github,
                    account: "octocat".into(),
                    secret: secret.into(),
                },
            )
            .unwrap();
        (store, credential_id)
    }

    #[test]
    fn github_list_repositories_dispatches_with_credential() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let fake = Arc::new(FakeTransport::new());
        fake.stub_json(
            ProviderHttpMethod::Get,
            "/user/repos",
            200,
            r#"[{"id":1,"name":"demo","fullName":"octocat/demo","description":null,"defaultBranch":"main","private":false,"cloneUrl":"https://github.com/octocat/demo.git","htmlUrl":"https://github.com/octocat/demo","owner":{"login":"octocat"},"updatedAt":"2024-01-01T00:00:00Z"}]"#,
        );
        let (store, credential_id) = store_with_github_token("ghp_test");
        let service = ProviderService::for_test(store, fake);
        let result = rt
            .block_on(service.list_repositories(ProviderListRepositoriesInput {
                credential_id,
                page: 1,
                per_page: 30,
            }))
            .unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].name, "demo");
    }

    #[test]
    fn github_get_repository_normalizes_response() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let fake = Arc::new(FakeTransport::new());
        fake.stub_json(
            ProviderHttpMethod::Get,
            "/repos/octocat/demo",
            200,
            r#"{"id":1,"name":"demo","fullName":"octocat/demo","description":"A repo","defaultBranch":"main","private":false,"cloneUrl":"https://github.com/octocat/demo.git","htmlUrl":"https://github.com/octocat/demo","owner":{"login":"octocat"},"updatedAt":"2024-01-01T00:00:00Z"}"#,
        );
        let (store, credential_id) = store_with_github_token("ghp_test");
        let service = ProviderService::for_test(store, fake);
        let repo = rt
            .block_on(service.get_repository(ProviderGetRepositoryInput {
                credential_id,
                organization: None,
                owner: "octocat".into(),
                repo: "demo".into(),
            }))
            .unwrap();
        assert_eq!(repo.full_name, "octocat/demo");
    }

    #[test]
    fn auth_failure_is_sanitized_without_secret_echo() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let fake = Arc::new(FakeTransport::new());
        fake.stub(
            ProviderHttpMethod::Get,
            "/user/repos",
            ProviderHttpResponse {
                status: 401,
                body: b"bad credentials".to_vec(),
            },
        );
        let (store, credential_id) = store_with_github_token("ghp_leaked_secret");
        let service = ProviderService::for_test(store, fake);
        let result = rt.block_on(service.list_repositories(ProviderListRepositoriesInput {
            credential_id,
            page: 1,
            per_page: 30,
        }));
        assert!(result.is_err());
        let err = result.unwrap_err();
        let message = err.message();
        assert!(!message.contains("ghp_leaked_secret"));
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
    }

    #[test]
    fn azure_requires_organization_for_get_repository() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let fake = Arc::new(FakeTransport::new());
        let store = Arc::new(InMemoryCredentialStore::new());
        let credential_id = "cred-azure".to_string();
        store
            .save(
                &credential_id,
                &StoredProviderCredential {
                    kind: ProviderKind::AzureDevops,
                    account: "dev".into(),
                    secret: "pat".into(),
                },
            )
            .unwrap();
        let service = ProviderService::for_test(store, fake);
        let result = rt.block_on(service.get_repository(ProviderGetRepositoryInput {
            credential_id,
            organization: None,
            owner: "proj".into(),
            repo: "repo".into(),
        }));
        assert!(result.is_err());
        assert!(result.unwrap_err().message().contains("organization"));
    }

    #[test]
    fn github_create_pull_request_dispatches() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let fake = Arc::new(FakeTransport::new());
        fake.stub_json(
            ProviderHttpMethod::Post,
            "/repos/octocat/demo/pulls",
            200,
            r#"{"id":9,"number":2,"title":"Fix","body":"details","state":"open","head":{"ref":"feature"},"base":{"ref":"main"},"htmlUrl":"https://github.com/octocat/demo/pull/2","user":{"login":"octocat"},"createdAt":"2024-01-01T00:00:00Z","updatedAt":null}"#,
        );
        let (store, credential_id) = store_with_github_token("ghp_test");
        let service = ProviderService::for_test(store, fake);
        let pr = rt
            .block_on(service.create_pull_request(ProviderCreatePullRequestInput {
                credential_id,
                organization: None,
                owner: "octocat".into(),
                repo: "demo".into(),
                title: "Fix".into(),
                description: Some("details".into()),
                source_branch: "feature".into(),
                target_branch: "main".into(),
            }))
            .unwrap();
        assert_eq!(pr.number, 2);
        assert_eq!(pr.state, ProviderPrState::Open);
    }

    #[test]
    fn bitbucket_release_returns_capability_error() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let fake = Arc::new(FakeTransport::new());
        let store = Arc::new(InMemoryCredentialStore::new());
        let credential_id = "cred-bb".to_string();
        store
            .save(
                &credential_id,
                &StoredProviderCredential {
                    kind: ProviderKind::Bitbucket,
                    account: "team".into(),
                    secret: "token".into(),
                },
            )
            .unwrap();
        let service = ProviderService::for_test(store, fake);
        let result = rt.block_on(service.create_release(ProviderCreateReleaseInput {
            credential_id,
            organization: None,
            owner: "team".into(),
            repo: "repo".into(),
            tag_name: "v1".into(),
            name: None,
            description: None,
            draft: false,
            prerelease: false,
        }));
        assert!(result.is_err());
        assert!(result.unwrap_err().message().contains("Bitbucket"));
    }
}
