import type { UnlistenFn } from "@tauri-apps/api/event";
import type { SourceControlApi } from "./sourceControlApi";
import type {
  SourceControlCommitInput,
  SourceControlCompareInput,
  SourceControlCompareResult,
  SourceControlDiscardInput,
  SourceControlFetchInput,
  SourceControlLogEntry,
  SourceControlLogInput,
  SourceControlMutationResult,
  SourceControlOperationEvent,
  SourceControlPullInput,
  SourceControlPushInput,
  SourceControlRefMutationInput,
  SourceControlRefMutationResult,
  SourceControlRefSummary,
  SourceControlRepositorySnapshot,
  SourceControlResolveCheckoutResult,
  SourceControlStageInput,
  SourceControlStashInput,
} from "./sourceControlContracts";

export interface MemorySourceControlSeed {
  resolveByTrunkId?: Record<string, SourceControlResolveCheckoutResult>;
  snapshotsByCheckoutIdentity?: Record<string, SourceControlRepositorySnapshot>;
}

export interface MemorySourceControlCall {
  method: keyof SourceControlApi;
  input: unknown;
}

export interface MemorySourceControlApi extends SourceControlApi {
  calls: MemorySourceControlCall[];
  emitOperationEvent(event: SourceControlOperationEvent): void;
}

function missingSnapshot(checkoutIdentity: string): never {
  throw new Error(`No SourceControl snapshot seeded for checkout: ${checkoutIdentity}`);
}

export function createMemorySourceControlApi(seed: MemorySourceControlSeed = {}): MemorySourceControlApi {
  const calls: MemorySourceControlCall[] = [];
  const snapshots = new Map(
    Object.entries(seed.snapshotsByCheckoutIdentity ?? {}).map(([key, value]) => [
      key,
      structuredClone(value),
    ]),
  );
  const listeners = new Set<(event: SourceControlOperationEvent) => void>();

  const record = (method: keyof SourceControlApi, input: unknown): void => {
    calls.push({ method, input: structuredClone(input) });
  };

  const getSnapshot = (checkoutIdentity: string): SourceControlRepositorySnapshot => {
    const value = snapshots.get(checkoutIdentity);
    if (!value) return missingSnapshot(checkoutIdentity);
    return structuredClone(value);
  };

  return {
    calls,
    resolveCheckout: async (input) => {
      record("resolveCheckout", input);
      return (
        seed.resolveByTrunkId?.[input.trunkId] ?? {
          status: "invalid",
          reason: "unknown",
          message: `No checkout seeded for trunk: ${input.trunkId}`,
          worktreePath: null,
          repositoryIdentity: null,
          savedRefName: null,
        }
      );
    },
    getSnapshot: async (input) => {
      record("getSnapshot", input);
      return getSnapshot(input.checkout.checkoutIdentity);
    },
    refreshLocal: async (input) => {
      record("refreshLocal", input);
      const current = getSnapshot(input.checkout.checkoutIdentity);
      const next = { ...current, revision: current.revision + 1 };
      snapshots.set(input.checkout.checkoutIdentity, next);
      return structuredClone(next);
    },
    initialize: async (input) => {
      record("initialize", input);
      const current = [...snapshots.values()].find(
        (item) => item.checkoutPath === input.checkoutPath,
      );
      if (!current) return missingSnapshot(input.checkoutPath);
      const next = {
        ...current,
        repositoryState: "unborn" as const,
        revision: current.revision + 1,
      };
      snapshots.set(next.checkoutIdentity, next);
      return structuredClone(next);
    },
    getDiff: async (input) => {
      record("getDiff", input);
      return {
        source: structuredClone(input.source),
        patch: "",
        files: [],
        additions: 0,
        deletions: 0,
        binary: false,
        truncated: false,
      };
    },
    stage: async (input: SourceControlStageInput): Promise<SourceControlMutationResult> => {
      record("stage", input);
      return { message: "Staged" };
    },
    discard: async (input: SourceControlDiscardInput): Promise<SourceControlMutationResult> => {
      record("discard", input);
      return { message: "Discarded" };
    },
    commit: async (input: SourceControlCommitInput): Promise<SourceControlMutationResult> => {
      record("commit", input);
      return { message: "Committed" };
    },
    stash: async (input: SourceControlStashInput): Promise<SourceControlMutationResult> => {
      record("stash", input);
      return { message: "Stashed" };
    },
    fetch: async (input: SourceControlFetchInput): Promise<SourceControlMutationResult> => {
      record("fetch", input);
      return { message: "Fetched" };
    },
    pull: async (input: SourceControlPullInput): Promise<SourceControlMutationResult> => {
      record("pull", input);
      return { message: "Pulled" };
    },
    push: async (input: SourceControlPushInput): Promise<SourceControlMutationResult> => {
      record("push", input);
      return { message: "Pushed" };
    },
    listRefs: async (checkoutPath: string): Promise<SourceControlRefSummary[]> => {
      record("listRefs", checkoutPath);
      return [];
    },
    mutateRef: async (input: SourceControlRefMutationInput): Promise<SourceControlRefMutationResult> => {
      record("mutateRef", input);
      return { message: "Ref mutated" };
    },
    log: async (input: SourceControlLogInput): Promise<SourceControlLogEntry[]> => {
      record("log", input);
      return [];
    },
    compare: async (input: SourceControlCompareInput): Promise<SourceControlCompareResult> => {
      record("compare", input);
      return { ahead: 0, behind: 0, commits: [] };
    },
    createWorktree: async (input) => {
      record("createWorktree", input);
      throw new Error("No worktree creation result seeded");
    },
    attachWorktree: async (input) => {
      record("attachWorktree", input);
      throw new Error("No worktree attachment result seeded");
    },
    repairWorktree: async (input) => {
      record("repairWorktree", input);
      throw new Error("No worktree repair result seeded");
    },
    inspectWorktreeRemoval: async (input) => {
      record("inspectWorktreeRemoval", input);
      throw new Error("No worktree removal inspection seeded");
    },
    removeWorktree: async (input) => {
      record("removeWorktree", input);
    },
    cancelOperation: async (operationId) => {
      record("cancelOperation", { operationId });
    },
    onOperationEvent: async (callback) => {
      record("onOperationEvent", null);
      listeners.add(callback);
      return (() => listeners.delete(callback)) satisfies UnlistenFn;
    },
    emitOperationEvent: (event) => {
      for (const callback of listeners) callback(structuredClone(event));
    },
  };
}
