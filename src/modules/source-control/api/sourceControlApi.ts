import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  SourceControlAttachWorktreeInput,
  SourceControlCheckoutRequest,
  SourceControlCommitInput,
  SourceControlCompareInput,
  SourceControlCompareResult,
  SourceControlCreateWorktreeInput,
  SourceControlDiffInput,
  SourceControlDiffResult,
  SourceControlDiscardInput,
  SourceControlFetchInput,
  SourceControlInitializeInput,
  SourceControlLogEntry,
  SourceControlLogInput,
  SourceControlMutationResult,
  SourceControlOperationEvent,
  SourceControlPullInput,
  SourceControlPushInput,
  SourceControlRefMutationInput,
  SourceControlRemoteResult,
  SourceControlRefMutationResult,
  SourceControlRefSummary,
  SourceControlRemoveWorktreeInput,
  SourceControlRepairWorktreeInput,
  SourceControlRepositorySnapshot,
  SourceControlResolveCheckoutInput,
  SourceControlResolveCheckoutResult,
  SourceControlStageInput,
  SourceControlStashInput,
  SourceControlWorktreeMutationResult,
  SourceControlWorktreeRemovalInspection,
} from "./sourceControlContracts";

export type { UnlistenFn };

export interface SourceControlApi {
  resolveCheckout(input: SourceControlResolveCheckoutInput): Promise<SourceControlResolveCheckoutResult>;
  getSnapshot(input: SourceControlCheckoutRequest): Promise<SourceControlRepositorySnapshot>;
  refreshLocal(input: SourceControlCheckoutRequest): Promise<SourceControlRepositorySnapshot>;
  initialize(input: SourceControlInitializeInput): Promise<SourceControlRepositorySnapshot>;
  getDiff(input: SourceControlDiffInput): Promise<SourceControlDiffResult>;
  stage(input: SourceControlStageInput): Promise<SourceControlMutationResult>;
  discard(input: SourceControlDiscardInput): Promise<SourceControlMutationResult>;
  commit(input: SourceControlCommitInput): Promise<SourceControlMutationResult>;
  stash(input: SourceControlStashInput): Promise<SourceControlMutationResult>;
  fetch(input: SourceControlFetchInput): Promise<SourceControlRemoteResult>;
  pull(input: SourceControlPullInput): Promise<SourceControlRemoteResult>;
  push(input: SourceControlPushInput): Promise<SourceControlRemoteResult>;
  listRefs(checkoutPath: string): Promise<SourceControlRefSummary[]>;
  mutateRef(input: SourceControlRefMutationInput): Promise<SourceControlRefMutationResult>;
  log(input: SourceControlLogInput): Promise<SourceControlLogEntry[]>;
  compare(input: SourceControlCompareInput): Promise<SourceControlCompareResult>;
  createWorktree(input: SourceControlCreateWorktreeInput): Promise<SourceControlWorktreeMutationResult>;
  attachWorktree(input: SourceControlAttachWorktreeInput): Promise<SourceControlWorktreeMutationResult>;
  repairWorktree(input: SourceControlRepairWorktreeInput): Promise<SourceControlWorktreeMutationResult>;
  inspectWorktreeRemoval(
    input: Pick<SourceControlRemoveWorktreeInput, "worktreePath" | "repositoryIdentity">,
  ): Promise<SourceControlWorktreeRemovalInspection>;
  removeWorktree(input: SourceControlRemoveWorktreeInput): Promise<void>;
  cancelOperation(operationId: string): Promise<void>;
  onOperationEvent(callback: (event: SourceControlOperationEvent) => void): Promise<UnlistenFn>;
}

export function createTauriSourceControlApi(): SourceControlApi {
  return {
    resolveCheckout: (input) => invoke("git_resolve_checkout", { input }),
    getSnapshot: (input) => invoke("git_get_snapshot", { input }),
    refreshLocal: (input) => invoke("git_refresh", { input }),
    initialize: (input) => invoke("git_initialize", { input }),
    getDiff: (input) => invoke("git_get_diff", { input }),
    stage: (input) => invoke("git_stage", { input }),
    discard: (input) => invoke("git_discard", { input }),
    commit: (input) => invoke("git_commit", { input }),
    stash: (input) => invoke("git_stash", { input }),
    fetch: (input) => invoke("git_fetch", { input }),
    pull: (input) => invoke("git_pull", { input }),
    push: (input) => invoke("git_push", { input }),
    listRefs: (checkoutPath) => invoke("git_list_refs", { checkoutPath }),
    mutateRef: (input) => invoke("git_mutate_ref", { input }),
    log: (input) => invoke("git_log", { input }),
    compare: (input) => invoke("git_compare", { input }),
    createWorktree: (input) => invoke("git_worktree_create", { input }),
    attachWorktree: (input) => invoke("git_worktree_attach", { input }),
    repairWorktree: (input) => invoke("git_worktree_repair", { input }),
    inspectWorktreeRemoval: (input) =>
      invoke("git_worktree_inspect_removal", { input }),
    removeWorktree: (input) => invoke("git_worktree_remove", { input }),
    cancelOperation: (operationId) =>
      invoke("git_operation_cancel", { input: { operationId } }),
    onOperationEvent: (callback) =>
      listen<SourceControlOperationEvent>("sourceControl://operation", (event) => callback(event.payload)),
  };
}

export { createMemorySourceControlApi } from "./createMemorySourceControlApi";
export type { MemorySourceControlApi, MemorySourceControlSeed } from "./createMemorySourceControlApi";
