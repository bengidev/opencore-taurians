#![allow(dead_code)] // Provider contract types consumed by provider commands and App bindings.

use serde::{Deserialize, Serialize};

use crate::provider::remote::{PaginatedResult, ProviderPullRequest, ProviderRelease, ProviderRepository};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind {
    Github,
    Gitlab,
    Bitbucket,
    AzureDevops,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAccount {
    pub id: String,
    pub kind: ProviderKind,
    pub display_name: String,
    pub username: String,
    pub keychain_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProviderCredential {
    pub kind: ProviderKind,
    pub account: String,
    pub secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialSaveInput {
    pub kind: ProviderKind,
    pub account: String,
    pub secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialRef {
    pub credential_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialSaveResult {
    pub credential_id: String,
    pub kind: ProviderKind,
    pub account: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialStatus {
    pub credential_id: String,
    pub kind: ProviderKind,
    pub account: String,
    pub found: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderListRepositoriesInput {
    pub credential_id: String,
    pub page: u32,
    pub per_page: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderGetRepositoryInput {
    pub credential_id: String,
    pub organization: Option<String>,
    pub owner: String,
    pub repo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCreateRepositoryInput {
    pub credential_id: String,
    pub organization: Option<String>,
    pub owner: String,
    pub name: String,
    pub description: Option<String>,
    pub private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderListPullRequestsInput {
    pub credential_id: String,
    pub organization: Option<String>,
    pub owner: String,
    pub repo: String,
    pub state: String,
    pub page: u32,
    pub per_page: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderGetPullRequestInput {
    pub credential_id: String,
    pub organization: Option<String>,
    pub owner: String,
    pub repo: String,
    pub number: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCreatePullRequestInput {
    pub credential_id: String,
    pub organization: Option<String>,
    pub owner: String,
    pub repo: String,
    pub title: String,
    pub description: Option<String>,
    pub source_branch: String,
    pub target_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCreateReleaseInput {
    pub credential_id: String,
    pub organization: Option<String>,
    pub owner: String,
    pub repo: String,
    pub tag_name: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub draft: bool,
    pub prerelease: bool,
}

pub type ProviderListRepositoriesResult = PaginatedResult<ProviderRepository>;
pub type ProviderGetRepositoryResult = ProviderRepository;
pub type ProviderCreateRepositoryResult = ProviderRepository;
pub type ProviderListPullRequestsResult = PaginatedResult<ProviderPullRequest>;
pub type ProviderGetPullRequestResult = ProviderPullRequest;
pub type ProviderCreatePullRequestResult = ProviderPullRequest;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderReleaseCapability {
    pub kind: ProviderKind,
    pub supports_native_releases: bool,
    pub description: String,
}

pub type ProviderCreateReleaseResult = ProviderRelease;
pub type ProviderReleaseCapabilitiesResult = Vec<ProviderReleaseCapability>;
