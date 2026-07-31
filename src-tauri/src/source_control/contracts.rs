use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublicSourceControlErrorCode {
    #[serde(rename = "git-unavailable")]
    SourceControlUnavailable,
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
pub struct PublicSourceControlError {
    pub code: PublicSourceControlErrorCode,
    pub operation: String,
    pub message: String,
    pub retryable: bool,
}

#[allow(dead_code)] // Public error-construction API for the git suite; consumed by command modules behind GIT_SUITE_RELEASE_ENABLED.
impl PublicSourceControlError {
    pub fn git_unavailable(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::SourceControlUnavailable,
            operation,
            "System SourceControl is unavailable.",
            true,
        )
    }

    pub fn not_repository(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::NotRepository,
            operation,
            "The selected checkout is not a SourceControl repository.",
            false,
        )
    }

    pub fn checkout_invalid(operation: &str, message: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::CheckoutInvalid,
            operation,
            message,
            false,
        )
    }

    pub fn scope_violation(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::ScopeViolation,
            operation,
            "The SourceControl checkout is outside the validated project scope.",
            false,
        )
    }

    pub fn timeout(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::Timeout,
            operation,
            "The SourceControl operation timed out.",
            true,
        )
    }

    pub fn output_limit(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::OutputLimit,
            operation,
            "The SourceControl operation produced too much output.",
            false,
        )
    }

    pub fn process_failed(operation: &str, retryable: bool) -> Self {
        Self::new(
            PublicSourceControlErrorCode::ProcessFailed,
            operation,
            "The SourceControl operation failed.",
            retryable,
        )
    }

    pub fn authentication_required(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::AuthenticationRequired,
            operation,
            "SourceControl authentication is required.",
            true,
        )
    }

    pub fn precondition_failed(operation: &str, message: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::PreconditionFailed,
            operation,
            message,
            false,
        )
    }

    pub fn not_found(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::NotFound,
            operation,
            "The requested SourceControl resource was not found.",
            false,
        )
    }

    pub fn cancelled(operation: &str) -> Self {
        Self::new(
            PublicSourceControlErrorCode::Cancelled,
            operation,
            "The SourceControl operation was cancelled.",
            false,
        )
    }

    fn new(code: PublicSourceControlErrorCode, operation: &str, message: &str, retryable: bool) -> Self {
        Self {
            code,
            operation: operation.to_string(),
            message: message.to_string(),
            retryable,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceControlCheckoutRestore {
    ProjectRoot {
        #[serde(rename = "repositoryIdentity")]
        repository_identity: Option<String>,
        #[serde(rename = "savedRefName")]
        saved_ref_name: Option<String>,
    },
    Worktree {
        #[serde(rename = "worktreePath")]
        worktree_path: String,
        #[serde(rename = "repositoryIdentity")]
        repository_identity: String,
        #[serde(rename = "savedRefName")]
        saved_ref_name: Option<String>,
        #[serde(rename = "managedByApp")]
        managed_by_app: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlResolveCheckoutInput {
    pub project_id: String,
    pub trunk_id: String,
    pub project_folder_path: String,
    pub git_checkout: SourceControlCheckoutRestore,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ResolvedSourceControlCheckoutKind {
    ProjectRoot,
    Worktree,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSourceControlCheckout {
    pub kind: ResolvedSourceControlCheckoutKind,
    pub checkout_path: String,
    pub checkout_identity: String,
    pub repository_identity: Option<String>,
    pub saved_ref_name: Option<String>,
    pub managed_by_app: bool,
    pub normalized_restore: SourceControlCheckoutRestore,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlCheckoutInvalidReason {
    MalformedRestore,
    MissingWorktree,
    MovedWorktree,
    RepositoryMismatch,
    RepositoryIdentityChanged,
    SavedRefMissing,
    RefCheckedOutElsewhere,
    PermissionDenied,
    ScopeInvalid,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum SourceControlResolveCheckoutResult {
    Ready {
        checkout: ResolvedSourceControlCheckout,
    },
    Invalid {
        reason: SourceControlCheckoutInvalidReason,
        message: String,
        #[serde(rename = "worktreePath")]
        worktree_path: Option<String>,
        #[serde(rename = "repositoryIdentity")]
        repository_identity: Option<String>,
        #[serde(rename = "savedRefName")]
        saved_ref_name: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCheckoutRequest {
    pub project_id: String,
    pub trunk_id: String,
    pub checkout: ResolvedSourceControlCheckout,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlInitializeInput {
    pub project_id: String,
    pub trunk_id: String,
    pub checkout_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceControlHeadSummary {
    Branch { name: String },
    Detached { oid: String },
    Unborn { name: Option<String> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlOperationKind {
    Merge,
    Rebase,
    CherryPick,
    Revert,
    Bisect,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlFileCode {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
    Untracked,
    Ignored,
    Conflicted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlFileStatus {
    pub path: String,
    pub old_path: Option<String>,
    pub index_status: Option<SourceControlFileCode>,
    pub worktree_status: Option<SourceControlFileCode>,
    pub conflict_status: Option<String>,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
    pub binary: bool,
    pub submodule: bool,
    pub lfs_pointer: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlProviderKind {
    Github,
    Gitlab,
    Bitbucket,
    AzureDevops,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRemoteSummary {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
    pub provider: Option<SourceControlProviderKind>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlPanelSectionCounts {
    pub changes: usize,
    pub staged_changes: usize,
    pub stashes: usize,
    pub worktrees: usize,
    pub submodules: usize,
    pub lfs_patterns: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlCapabilities {
    pub git_version: Option<String>,
    pub supports_worktrees: bool,
    pub lfs_available: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceControlRepositoryStatus {
    #[serde(rename = "git-unavailable")]
    SourceControlUnavailable,
    NotRepository,
    Unborn,
    Ready,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlRepositorySnapshot {
    pub project_id: String,
    pub trunk_id: String,
    pub checkout_path: String,
    pub checkout_identity: String,
    pub repository_identity: Option<String>,
    pub revision: u64,
    pub captured_at: String,
    pub repository_state: SourceControlRepositoryStatus,
    pub worktree_label: String,
    pub head: Option<SourceControlHeadSummary>,
    pub upstream: Option<String>,
    pub default_branch: Option<String>,
    pub ahead: u64,
    pub behind: u64,
    pub files: Vec<SourceControlFileStatus>,
    pub conflict_count: usize,
    pub operation: Option<SourceControlOperationSummary>,
    pub remotes: Vec<SourceControlRemoteSummary>,
    pub section_counts: SourceControlPanelSectionCounts,
    pub capabilities: SourceControlCapabilities,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceControlOperationSummary {
    pub kind: SourceControlOperationKind,
    pub phase: String,
}
