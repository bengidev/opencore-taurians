export type RightPanelFeature = "files" | "sourceControl";

export type SourceControlCheckoutRestore =
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

export interface ResolvedSourceControlCheckout {
  kind: "project-root" | "worktree";
  scopeId: string;
  checkoutPath: string;
  checkoutIdentity: string;
  repositoryIdentity: string | null;
  savedRefName: string | null;
  managedByApp: boolean;
  normalizedRestore: SourceControlCheckoutRestore;
}

export interface SourceControlResolveCheckoutInput {
  projectId: string;
  trunkId: string;
  projectFolderPath: string;
  gitCheckout: SourceControlCheckoutRestore;
}

export type SourceControlCheckoutInvalidReason =
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

export type SourceControlResolveCheckoutResult =
  | { status: "ready"; checkout: ResolvedSourceControlCheckout }
  | {
      status: "invalid";
      reason: SourceControlCheckoutInvalidReason;
      message: string;
      worktreePath: string | null;
      repositoryIdentity: string | null;
      savedRefName: string | null;
    };

export type SourceControlHeadSummary =
  | { kind: "branch"; name: string }
  | { kind: "detached"; oid: string }
  | { kind: "unborn"; name: string | null };

export type SourceControlOperationKind =
  | "merge"
  | "rebase"
  | "cherry-pick"
  | "revert"
  | "bisect";

export type SourceControlFileCode =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed"
  | "untracked"
  | "ignored"
  | "conflicted";

export interface SourceControlFileStatus {
  path: string;
  oldPath: string | null;
  indexStatus: SourceControlFileCode | null;
  worktreeStatus: SourceControlFileCode | null;
  conflictStatus: string | null;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
  submodule: boolean;
  lfsPointer: boolean;
}

export interface SourceControlRemoteSummary {
  name: string;
  fetchUrl: string;
  pushUrl: string;
  provider: SourceControlProviderKind | null;
}

export type SourceControlProviderKind =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "azure-devops";

export interface SourceControlPanelSectionCounts {
  changes: number;
  stagedChanges: number;
  stashes: number;
  worktrees: number;
  submodules: number;
  lfsPatterns: number;
}

export interface SourceControlCapabilities {
  gitVersion: string | null;
  supportsWorktrees: boolean;
  lfsAvailable: boolean;
}

export type SourceControlRepositoryState =
  | "git-unavailable"
  | "not-repository"
  | "unborn"
  | "ready";

export interface SourceControlRepositorySnapshot {
  scopeId: string;
  projectId: string;
  trunkId: string;
  checkoutPath: string;
  checkoutIdentity: string;
  repositoryIdentity: string | null;
  revision: number;
  capturedAt: string;
  repositoryState: SourceControlRepositoryState;
  worktreeLabel: string;
  head: SourceControlHeadSummary | null;
  upstream: string | null;
  defaultBranch: string | null;
  ahead: number;
  behind: number;
  files: SourceControlFileStatus[];
  conflictCount: number;
  operation: { kind: SourceControlOperationKind; phase: string } | null;
  remotes: SourceControlRemoteSummary[];
  sectionCounts: SourceControlPanelSectionCounts;
  capabilities: SourceControlCapabilities;
}

export interface SourceControlCheckoutRequest {
  scopeId: string;
}

export interface SourceControlInitializeInput {
  scopeId: string;
}

export type SourceControlDiffSource =
  | { kind: "working-tree" }
  | { kind: "staged" }
  | { kind: "branch-range"; baseRef: string; headRef: string | null }
  | { kind: "commit"; oid: string }
  | { kind: "commit-range"; baseOid: string; headOid: string };

export interface SourceControlDiffInput {
  scopeId: string;
  source: SourceControlDiffSource;
  ignoreWhitespace: boolean;
  maxBytes: number;
  pathspec: string | null;
}

export type SourceControlStageMode = "stage" | "unstage";
export type SourceControlDiscardMode = "tracked" | "untracked";
export type SourceControlPullStrategy = "ff-only" | "merge";

export type SourceControlStashAction =
  | { kind: "create" }
  | { kind: "apply"; index: number }
  | { kind: "pop"; index: number }
  | { kind: "branch"; index: number; branchName: string }
  | { kind: "drop"; index: number };

export interface SourceControlStageInput {
  scopeId: string;
  paths: string[];
  mode: SourceControlStageMode;
}
export interface SourceControlDiscardInput {
  scopeId: string;
  paths: string[];
  mode: SourceControlDiscardMode;
}
export interface SourceControlCommitInput {
  scopeId: string;
  subject: string;
  body: string;
  amend: boolean;
  signoff: boolean;
  newBranch: string | null;
  selectedPaths: string[] | null;
}
export interface SourceControlStashInput {
  scopeId: string;
  message: string | null;
  includeUntracked: boolean;
  action: SourceControlStashAction;
}
export interface SourceControlMutationResult { message: string }

export interface SourceControlFetchInput {
  scopeId: string;
  prune: boolean;
  remote: string | null;
}
export interface SourceControlPullInput {
  scopeId: string;
  strategy: SourceControlPullStrategy;
  rebase: boolean;
}
export interface SourceControlPushInput {
  scopeId: string;
  remote: string | null;
  refspec: string | null;
  setUpstream: boolean;
  forceWithLease: string | null;
}
export interface SourceControlRemoteResult { message: string }

export type SourceControlRefKind = "Branch" | "Remote" | "Tag";
export interface SourceControlRefSummary {
  name: string;
  kind: SourceControlRefKind;
  oid: string;
  upstream: string | null;
  isCurrent: boolean;
}
export interface SourceControlRefMutationInput {
  scopeId: string;
  action: string;
  name: string;
  target: string | null;
  force: boolean;
}
export interface SourceControlRefsInput { scopeId: string }
export interface SourceControlRefMutationResult { message: string }

export interface SourceControlLogInput {
  scopeId: string;
  maxCount: number;
  branch: string | null;
  search: string | null;
}
export interface SourceControlLogEntry {
  oid: string;
  shortOid: string;
  subject: string;
  author: string;
  dateIso: string;
  refs: string[];
}
export interface SourceControlCompareInput {
  scopeId: string;
  base: string;
  head: string;
}
export interface SourceControlCompareResult {
  ahead: number;
  behind: number;
  commits: string[];
}

export interface SourceControlSubmoduleInput {
  scopeId: string;
  action: "init" | "update" | "sync" | "deinit" | "status";
  recursive: boolean;
}
export interface SourceControlLfsInput {
  scopeId: string;
  action: "track" | "untrack" | "fetch" | "pull" | "status" | "availability";
  patterns: string[];
}
export interface SourceControlHooksInput { scopeId: string }
export interface SourceControlHookInfo { path: string; present: boolean }
export interface SourceControlCloneInput {
  scopeId: string;
  url: string;
  destinationName: string;
  branch: string | null;
  recurseSubmodules: boolean;
}
export interface SourceControlCloneResult { path: string; message: string }


export interface SourceControlDiffFileSummary {
  path: string;
  oldPath: string | null;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface SourceControlDiffResult {
  source: SourceControlDiffSource;
  patch: string;
  files: SourceControlDiffFileSummary[];
  additions: number;
  deletions: number;
  binary: boolean;
  truncated: boolean;
}

export interface SourceControlCreateWorktreeInput {
  projectId: string;
  parentTrunkId: string;
  trunkId: string;
  projectFolderPath: string;
  baseRefName: string;
  branchName: string;
  historyMode: "normal" | "orphan";
}

export interface SourceControlAttachWorktreeInput {
  projectId: string;
  parentTrunkId: string;
  trunkId: string;
  projectFolderPath: string;
  worktreePath: string;
}

export interface SourceControlWorktreeMutationResult {
  checkout: ResolvedSourceControlCheckout;
}

export type SourceControlRepairWorktreeInput =
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

export interface SourceControlWorktreeRemovalInspection {
  worktreePath: string;
  repositoryIdentity: string;
  managedByApp: boolean;
  dirty: boolean;
  hasUnmergedChanges: boolean;
  hasUnmergedCommits: boolean;
  headOid: string | null;
  affectedTrunkIds: string[];
}

export interface SourceControlRemoveWorktreeInput {
  scopeId?: string | null;
  worktreePath: string;
  repositoryIdentity: string;
  expectedHeadOid: string | null;
  allowDirty: boolean;
  allowUnmergedChanges: boolean;
  allowUnmergedCommits: boolean;
}

export interface PublicSourceControlError {
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

interface SourceControlOperationBase {
  operationId: string;
  repositoryId: string;
  trunkId: string;
}

export type SourceControlOperationEvent =
  | (SourceControlOperationBase & {
      kind: "started";
      phase: string;
      cancellable: boolean;
    })
  | (SourceControlOperationBase & {
      kind: "progress";
      phase: string;
      message: string;
      cancellable: boolean;
      completed?: number;
      total?: number;
    })
  | (SourceControlOperationBase & {
      kind: "completed";
      resultSummary: string;
    })
  | (SourceControlOperationBase & {
      kind: "failed";
      error: PublicSourceControlError;
    })
  | (SourceControlOperationBase & { kind: "cancelled" });
