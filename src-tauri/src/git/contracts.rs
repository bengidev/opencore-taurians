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

    pub fn not_repository(operation: &str) -> Self {
        Self::new(
            PublicGitErrorCode::NotRepository,
            operation,
            "The selected checkout is not a Git repository.",
            false,
        )
    }

    pub fn checkout_invalid(operation: &str, message: &str) -> Self {
        Self::new(
            PublicGitErrorCode::CheckoutInvalid,
            operation,
            message,
            false,
        )
    }

    pub fn scope_violation(operation: &str) -> Self {
        Self::new(
            PublicGitErrorCode::ScopeViolation,
            operation,
            "The Git checkout is outside the validated project scope.",
            false,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum GitCheckoutRestore {
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
pub struct GitResolveCheckoutInput {
    pub project_id: String,
    pub trunk_id: String,
    pub project_folder_path: String,
    pub git_checkout: GitCheckoutRestore,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ResolvedGitCheckoutKind {
    ProjectRoot,
    Worktree,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedGitCheckout {
    pub kind: ResolvedGitCheckoutKind,
    pub checkout_path: String,
    pub checkout_identity: String,
    pub repository_identity: Option<String>,
    pub saved_ref_name: Option<String>,
    pub managed_by_app: bool,
    pub normalized_restore: GitCheckoutRestore,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GitCheckoutInvalidReason {
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
pub enum GitResolveCheckoutResult {
    Ready { checkout: ResolvedGitCheckout },
    Invalid {
        reason: GitCheckoutInvalidReason,
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
pub struct GitCheckoutRequest {
    pub project_id: String,
    pub trunk_id: String,
    pub checkout: ResolvedGitCheckout,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInitializeInput {
    pub project_id: String,
    pub trunk_id: String,
    pub checkout_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum GitHeadSummary {
    Branch { name: String },
    Detached { oid: String },
    Unborn { name: Option<String> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GitOperationKind {
    Merge,
    Rebase,
    CherryPick,
    Revert,
    Bisect,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GitFileCode {
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
pub struct GitFileStatus {
    pub path: String,
    pub old_path: Option<String>,
    pub index_status: Option<GitFileCode>,
    pub worktree_status: Option<GitFileCode>,
    pub conflict_status: Option<String>,
    pub additions: Option<u64>,
    pub deletions: Option<u64>,
    pub binary: bool,
    pub submodule: bool,
    pub lfs_pointer: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GitProviderKind {
    Github,
    Gitlab,
    Bitbucket,
    AzureDevops,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRemoteSummary {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
    pub provider: Option<GitProviderKind>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitPanelSectionCounts {
    pub changes: usize,
    pub staged_changes: usize,
    pub stashes: usize,
    pub worktrees: usize,
    pub submodules: usize,
    pub lfs_patterns: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCapabilities {
    pub git_version: Option<String>,
    pub supports_worktrees: bool,
    pub lfs_available: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GitRepositoryStatus {
    GitUnavailable,
    NotRepository,
    Unborn,
    Ready,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepositorySnapshot {
    pub project_id: String,
    pub trunk_id: String,
    pub checkout_path: String,
    pub checkout_identity: String,
    pub repository_identity: Option<String>,
    pub revision: u64,
    pub captured_at: String,
    pub repository_state: GitRepositoryStatus,
    pub worktree_label: String,
    pub head: Option<GitHeadSummary>,
    pub upstream: Option<String>,
    pub default_branch: Option<String>,
    pub ahead: u64,
    pub behind: u64,
    pub files: Vec<GitFileStatus>,
    pub conflict_count: usize,
    pub operation: Option<GitOperationSummary>,
    pub remotes: Vec<GitRemoteSummary>,
    pub section_counts: GitPanelSectionCounts,
    pub capabilities: GitCapabilities,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitOperationSummary {
    pub kind: GitOperationKind,
    pub phase: String,
}
