#![allow(dead_code)] // Normalized provider types behind GIT_SUITE_RELEASE_ENABLED; consumed by provider clients and tests.
use serde::{Deserialize, Serialize};

use crate::source_control::contracts::PublicSourceControlError;

// ---------- Normalized provider types ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRepository {
    pub id: String,
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub default_branch: Option<String>,
    pub private: bool,
    pub clone_url: String,
    pub html_url: String,
    pub owner: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPullRequest {
    pub id: String,
    pub number: u64,
    pub title: String,
    pub description: Option<String>,
    pub state: ProviderPrState,
    pub source_branch: String,
    pub target_branch: String,
    pub html_url: String,
    pub author: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderPrState {
    Open,
    Closed,
    Merged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResult<T> {
    pub items: Vec<T>,
    pub total: Option<u64>,
    pub has_more: bool,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRelease {
    pub id: String,
    pub tag_name: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub draft: bool,
    pub prerelease: bool,
    pub html_url: String,
    pub created_at: Option<String>,
}

// ---------- Provider error ----------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[allow(clippy::enum_variant_names)] // catch-all variant intentionally mirrors the enum name
pub enum ProviderError {
    AuthFailed { message: String },
    NotFound { message: String },
    RateLimited { message: String },
    NetworkError { message: String },
    ProviderError { message: String },
}

impl ProviderError {
    pub fn message(&self) -> &str {
        match self {
            ProviderError::AuthFailed { message }
            | ProviderError::NotFound { message }
            | ProviderError::RateLimited { message }
            | ProviderError::NetworkError { message }
            | ProviderError::ProviderError { message } => message,
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ProviderError::RateLimited { .. } | ProviderError::NetworkError { .. }
        )
    }

    pub fn to_public_source_control_error(&self, operation: &str) -> PublicSourceControlError {
        match self {
            ProviderError::AuthFailed { message: _ } => {
                PublicSourceControlError::authentication_required(operation)
            }
            ProviderError::NotFound { message: _ } => PublicSourceControlError::not_found(operation),
            ProviderError::RateLimited { message: _ } => {
                PublicSourceControlError::process_failed(operation, true)
            }
            ProviderError::NetworkError { message: _ } => {
                PublicSourceControlError::process_failed(operation, true)
            }
            ProviderError::ProviderError { message: _ } => {
                PublicSourceControlError::process_failed(operation, false)
            }
        }
    }
}

impl From<crate::provider::transport::ProviderTransportError> for ProviderError {
    fn from(e: crate::provider::transport::ProviderTransportError) -> Self {
        match e.kind {
            crate::provider::transport::ProviderTransportErrorKind::AuthFailed => {
                ProviderError::AuthFailed { message: e.message }
            }
            crate::provider::transport::ProviderTransportErrorKind::NotFound => {
                ProviderError::NotFound { message: e.message }
            }
            crate::provider::transport::ProviderTransportErrorKind::RateLimited => {
                ProviderError::RateLimited { message: e.message }
            }
            crate::provider::transport::ProviderTransportErrorKind::RedirectDenied
            | crate::provider::transport::ProviderTransportErrorKind::SsrfBlocked => {
                ProviderError::NetworkError { message: e.message }
            }
            _ => ProviderError::ProviderError { message: e.message },
        }
    }
}
