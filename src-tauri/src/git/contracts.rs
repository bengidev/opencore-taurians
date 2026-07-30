use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublicGitErrorCode {
    GitUnavailable,
    NotRepository,
    CheckoutInvalid,
    ScopeViolation,
    NotFound,
    PreconditionFailed,
    RefSelectionRequired,
    AuthenticationRequired,
    Timeout,
    OutputLimit,
    Cancelled,
    ProcessFailed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicGitError {
    pub code: PublicGitErrorCode,
    pub operation: String,
    pub message: String,
    pub retryable: bool,
}

impl PublicGitError {
    pub fn git_unavailable(operation: &str) -> Self {
        Self::new(
            PublicGitErrorCode::GitUnavailable,
            operation,
            "System Git is unavailable.",
            true,
        )
    }

    pub fn timeout(operation: &str) -> Self {
        Self::new(
            PublicGitErrorCode::Timeout,
            operation,
            "The Git operation timed out.",
            true,
        )
    }

    pub fn output_limit(operation: &str) -> Self {
        Self::new(
            PublicGitErrorCode::OutputLimit,
            operation,
            "The Git operation produced too much output.",
            false,
        )
    }

    pub fn process_failed(operation: &str, retryable: bool) -> Self {
        Self::new(
            PublicGitErrorCode::ProcessFailed,
            operation,
            "The Git operation failed.",
            retryable,
        )
    }

    pub fn authentication_required(operation: &str) -> Self {
        Self::new(
            PublicGitErrorCode::AuthenticationRequired,
            operation,
            "Git authentication is required.",
            true,
        )
    }

    fn new(
        code: PublicGitErrorCode,
        operation: &str,
        message: &str,
        retryable: bool,
    ) -> Self {
        Self {
            code,
            operation: operation.to_string(),
            message: message.to_string(),
            retryable,
        }
    }
}
