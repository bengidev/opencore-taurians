#![allow(dead_code)] // Provider contract types behind GIT_SUITE_RELEASE_ENABLED; consumed by provider clients and tests.
use serde::{Deserialize, Serialize};

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
