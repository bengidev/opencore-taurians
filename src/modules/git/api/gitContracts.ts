export type RightPanelFeature = "files" | "git";

export type GitCheckoutRestore =
  | {
      kind: "project-root";
      repositoryIdentity: string | null;
      savedRefName: string | null;
    }
  | {
      kind: "worktree";
      worktreePath: string;
      repositoryIdentity: string;
      savedRefName: string | null;
      managedByApp: boolean;
    };

export interface ResolvedGitCheckout {
  kind: "project-root" | "worktree";
  checkoutPath: string;
  checkoutIdentity: string;
  repositoryIdentity: string | null;
  savedRefName: string | null;
  managedByApp: boolean;
  normalizedRestore: GitCheckoutRestore;
}

export interface GitResolveCheckoutInput {
  projectId: string;
  trunkId: string;
  projectFolderPath: string;
  gitCheckout: GitCheckoutRestore;
}

export type GitCheckoutInvalidReason =
  | "malformed-restore"
  | "missing-worktree"
  | "moved-worktree"
  | "repository-mismatch"
  | "repository-identity-changed"
  | "saved-ref-missing"
  | "ref-checked-out-elsewhere"
  | "permission-denied"
  | "scope-invalid"
  | "unknown";

export type GitResolveCheckoutResult =
  | { status: "ready"; checkout: ResolvedGitCheckout }
  | {
      status: "invalid";
      reason: GitCheckoutInvalidReason;
      message: string;
      worktreePath: string | null;
      repositoryIdentity: string | null;
      savedRefName: string | null;
    };

export type GitHeadSummary =
  | { kind: "branch"; name: string }
  | { kind: "detached"; oid: string }
  | { kind: "unborn"; name: string | null };

export type GitOperationKind =
  | "merge"
  | "rebase"
  | "cherry-pick"
  | "revert"
  | "bisect";

export type GitFileCode =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed"
  | "untracked"
  | "ignored"
  | "conflicted";

export interface GitFileStatus {
  path: string;
  oldPath: string | null;
  indexStatus: GitFileCode | null;
  worktreeStatus: GitFileCode | null;
  conflictStatus: string | null;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
  submodule: boolean;
  lfsPointer: boolean;
}

export interface GitRemoteSummary {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  provider: GitProviderKind | null;
}

export type GitProviderKind =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "azure-devops";

export interface GitPanelSectionCounts {
  changes: number;
  stagedChanges: number;
  stashes: number;
  worktrees: number;
  submodules: number;
  lfsPatterns: number;
}

export interface GitCapabilities {
  gitVersion: string | null;
  supportsWorktrees: boolean;
  lfsAvailable: boolean;
}

export type GitRepositoryState =
  | "git-unavailable"
  | "not-repository"
  | "unborn"
  | "ready";

export interface GitRepositorySnapshot {
  projectId: string;
  trunkId: string;
  checkoutPath: string;
  checkoutIdentity: string;
  repositoryIdentity: string | null;
  revision: number;
  capturedAt: string;
  repositoryState: GitRepositoryState;
  worktreeLabel: string;
  head: GitHeadSummary | null;
  upstream: string | null;
  defaultBranch: string | null;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  conflictCount: number;
  operation: { kind: GitOperationKind; phase: string } | null;
  remotes: GitRemoteSummary[];
  sectionCounts: GitPanelSectionCounts;
  capabilities: GitCapabilities;
}

export interface GitCheckoutRequest {
  projectId: string;
  trunkId: string;
  checkout: ResolvedGitCheckout;
}

export interface GitInitializeInput {
  projectId: string;
  trunkId: string;
  checkoutPath: string;
}

export type GitDiffSource =
  | { kind: "working-tree" }
  | { kind: "staged" }
  | { kind: "branch-range"; baseRef: string; headRef: string | null }
  | { kind: "commit"; oid: string }
  | { kind: "commit-range"; baseOid: string; headOid: string };

export interface GitDiffInput extends GitCheckoutRequest {
  source: GitDiffSource;
  ignoreWhitespace: boolean;
  maxBytes: number;
}

export interface GitDiffFileSummary {
  path: string;
  oldPath: string | null;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface GitDiffResult {
  source: GitDiffSource;
  patch: string;
  files: GitDiffFileSummary[];
  additions: number;
  deletions: number;
  binary: boolean;
  truncated: boolean;
}

export interface GitCreateWorktreeInput {
  projectId: string;
  parentTrunkId: string;
  trunkId: string;
  projectFolderPath: string;
  baseRefName: string;
  branchName: string;
  historyMode: "normal" | "orphan";
}

export interface GitAttachWorktreeInput {
  projectId: string;
  parentTrunkId: string;
  trunkId: string;
  projectFolderPath: string;
  worktreePath: string;
}

export interface GitWorktreeMutationResult {
  checkout: ResolvedGitCheckout;
}

export type GitRepairWorktreeInput =
  | {
      kind: "reattach";
      projectId: string;
      trunkId: string;
      projectFolderPath: string;
      expectedRepositoryIdentity: string;
      worktreePath: string;
    }
  | {
      kind: "recreate";
      projectId: string;
      trunkId: string;
      projectFolderPath: string;
      expectedRepositoryIdentity: string;
      refName: string;
    };

export interface GitWorktreeRemovalInspection {
  worktreePath: string;
  repositoryIdentity: string;
  managedByApp: boolean;
  dirty: boolean;
  hasUnmergedChanges: boolean;
  hasUnmergedCommits: boolean;
  headOid: string | null;
  affectedTrunkIds: string[];
}

export interface GitRemoveWorktreeInput {
  worktreePath: string;
  repositoryIdentity: string;
  expectedHeadOid: string | null;
  allowDirty: boolean;
  allowUnmergedChanges: boolean;
  allowUnmergedCommits: boolean;
}

export interface PublicGitError {
  code:
    | "git-unavailable"
    | "not-repository"
    | "checkout-invalid"
    | "scope-violation"
    | "not-found"
    | "precondition-failed"
    | "ref-selection-required"
    | "authentication-required"
    | "timeout"
    | "output-limit"
    | "cancelled"
    | "process-failed";
  operation: string;
  message: string;
  retryable: boolean;
}

interface GitOperationBase {
  operationId: string;
  repositoryId: string;
  trunkId: string;
}

export type GitOperationEvent =
  | (GitOperationBase & {
      kind: "started";
      phase: string;
      cancellable: boolean;
    })
  | (GitOperationBase & {
      kind: "progress";
      phase: string;
      message: string;
      cancellable: boolean;
      completed?: number;
      total?: number;
    })
  | (GitOperationBase & {
      kind: "completed";
      resultSummary: string;
    })
  | (GitOperationBase & {
      kind: "failed";
      error: PublicGitError;
    })
  | (GitOperationBase & { kind: "cancelled" });
