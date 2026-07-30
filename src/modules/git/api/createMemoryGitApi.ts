import type { UnlistenFn } from "@tauri-apps/api/event";
import type { GitApi } from "./gitApi";
import type {
  GitOperationEvent,
  GitRepositorySnapshot,
  GitResolveCheckoutResult,
} from "./gitContracts";

export interface MemoryGitSeed {
  resolveByTrunkId?: Record<string, GitResolveCheckoutResult>;
  snapshotsByCheckoutIdentity?: Record<string, GitRepositorySnapshot>;
}

export interface MemoryGitCall {
  method: keyof GitApi;
  input: unknown;
}

export interface MemoryGitApi extends GitApi {
  calls: MemoryGitCall[];
  emitOperationEvent(event: GitOperationEvent): void;
}

function missingSnapshot(checkoutIdentity: string): never {
  throw new Error(`No Git snapshot seeded for checkout: ${checkoutIdentity}`);
}

export function createMemoryGitApi(seed: MemoryGitSeed = {}): MemoryGitApi {
  const calls: MemoryGitCall[] = [];
  const snapshots = new Map(
    Object.entries(seed.snapshotsByCheckoutIdentity ?? {}).map(([key, value]) => [
      key,
      structuredClone(value),
    ]),
  );
  const listeners = new Set<(event: GitOperationEvent) => void>();

  const record = (method: keyof GitApi, input: unknown): void => {
    calls.push({ method, input: structuredClone(input) });
  };

  const getSnapshot = (checkoutIdentity: string): GitRepositorySnapshot => {
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
