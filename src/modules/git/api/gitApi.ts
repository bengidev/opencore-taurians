import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  GitAttachWorktreeInput,
  GitCheckoutRequest,
  GitCreateWorktreeInput,
  GitDiffInput,
  GitDiffResult,
  GitInitializeInput,
  GitOperationEvent,
  GitRemoveWorktreeInput,
  GitRepairWorktreeInput,
  GitRepositorySnapshot,
  GitResolveCheckoutInput,
  GitResolveCheckoutResult,
  GitWorktreeMutationResult,
  GitWorktreeRemovalInspection,
} from "./gitContracts";

export type { UnlistenFn };

export interface GitApi {
  resolveCheckout(input: GitResolveCheckoutInput): Promise<GitResolveCheckoutResult>;
  getSnapshot(input: GitCheckoutRequest): Promise<GitRepositorySnapshot>;
  refreshLocal(input: GitCheckoutRequest): Promise<GitRepositorySnapshot>;
  initialize(input: GitInitializeInput): Promise<GitRepositorySnapshot>;
  getDiff(input: GitDiffInput): Promise<GitDiffResult>;
  createWorktree(input: GitCreateWorktreeInput): Promise<GitWorktreeMutationResult>;
  attachWorktree(input: GitAttachWorktreeInput): Promise<GitWorktreeMutationResult>;
  repairWorktree(input: GitRepairWorktreeInput): Promise<GitWorktreeMutationResult>;
  inspectWorktreeRemoval(
    input: Pick<GitRemoveWorktreeInput, "worktreePath" | "repositoryIdentity">,
  ): Promise<GitWorktreeRemovalInspection>;
  removeWorktree(input: GitRemoveWorktreeInput): Promise<void>;
  cancelOperation(operationId: string): Promise<void>;
  onOperationEvent(callback: (event: GitOperationEvent) => void): Promise<UnlistenFn>;
}

export function createTauriGitApi(): GitApi {
  return {
    resolveCheckout: (input) => invoke("git_resolve_checkout", { input }),
    getSnapshot: (input) => invoke("git_get_snapshot", { input }),
    refreshLocal: (input) => invoke("git_refresh", { input }),
    initialize: (input) => invoke("git_initialize", { input }),
    getDiff: (input) => invoke("git_get_diff", { input }),
    createWorktree: (input) => invoke("git_worktree_create", { input }),
    attachWorktree: (input) => invoke("git_worktree_attach", { input }),
    repairWorktree: (input) => invoke("git_worktree_repair", { input }),
    inspectWorktreeRemoval: (input) =>
      invoke("git_worktree_inspect_removal", { input }),
    removeWorktree: (input) => invoke("git_worktree_remove", { input }),
    cancelOperation: (operationId) =>
      invoke("git_operation_cancel", { input: { operationId } }),
    onOperationEvent: (callback) =>
      listen<GitOperationEvent>("git://operation", (event) => callback(event.payload)),
  };
}

export { createMemoryGitApi } from "./createMemoryGitApi";
export type { MemoryGitApi, MemoryGitSeed } from "./createMemoryGitApi";
