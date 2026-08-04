import { create } from "zustand";
import type { SourceControlApi } from "../api/sourceControlApi";
import { createTauriSourceControlApi } from "../api/sourceControlApi";
import type {
  PublicSourceControlError,
  ResolvedSourceControlCheckout,
  SourceControlCommitInput,
  SourceControlDiscardInput,
  SourceControlFetchInput,
  SourceControlPullInput,
  SourceControlPushInput,
  SourceControlRepositorySnapshot,
  SourceControlStageInput,
  SourceControlStashInput,
  SourceControlLogEntry,
  SourceControlLogInput,
} from "../api/sourceControlContracts";
import { toPublicSourceControlError } from "./sourceControlErrorParsing";
import { invalidateCheckoutRuntimeOnScopeError } from "./sourceControlCheckoutRuntimeInvalidation";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type { DiffKind, DiffKey } from "./sourceControlDiffKey";
export { sourceControlDiffKey } from "./sourceControlDiffKey";

const defaultApi = createTauriSourceControlApi();

export interface SourceControlState {
  snapshotsByTrunkId: Record<string, SourceControlRepositorySnapshot>;
  logByTrunkId: Record<string, SourceControlLogEntry[]>;
  loadingByTrunkId: Record<string, boolean>;
  errorByTrunkId: Record<string, PublicSourceControlError | null>;
  lastRevisionByTrunkId: Record<string, number>;
  activeOperations: Record<string, string[]>;
  api: SourceControlApi | null;
  bindApi(api: SourceControlApi): void;
  loadSnapshot(trunkId: string, checkout: ResolvedSourceControlCheckout): Promise<void>;
  refresh(trunkId: string, checkout: ResolvedSourceControlCheckout): Promise<void>;
  loadLog(trunkId: string, checkout: ResolvedSourceControlCheckout, branch?: string | null): Promise<void>;
  runStage(trunkId: string, checkout: ResolvedSourceControlCheckout, input: SourceControlStageInput): Promise<void>;
  runDiscard(
    trunkId: string,
    checkout: ResolvedSourceControlCheckout,
    input: SourceControlDiscardInput,
  ): Promise<void>;
  runCommit(trunkId: string, checkout: ResolvedSourceControlCheckout, input: SourceControlCommitInput): Promise<void>;
  runStash(trunkId: string, checkout: ResolvedSourceControlCheckout, input: SourceControlStashInput): Promise<void>;
  runFetch(trunkId: string, checkout: ResolvedSourceControlCheckout, input: SourceControlFetchInput): Promise<void>;
  runPull(trunkId: string, checkout: ResolvedSourceControlCheckout, input: SourceControlPullInput): Promise<void>;
  runPush(trunkId: string, checkout: ResolvedSourceControlCheckout, input: SourceControlPushInput): Promise<void>;
  clearTrunk(trunkId: string): void;
}

const EMPTY: Omit<
  SourceControlState,
  | "bindApi"
  | "loadSnapshot"
  | "refresh"
  | "loadLog"
  | "runStage"
  | "runDiscard"
  | "runCommit"
  | "runStash"
  | "runFetch"
  | "runPull"
  | "runPush"
  | "clearTrunk"
> = {
  snapshotsByTrunkId: {},
  logByTrunkId: {},
  loadingByTrunkId: {},
  errorByTrunkId: {},
  lastRevisionByTrunkId: {},
  activeOperations: {},
  api: null,
};

let currentUnlisten: UnlistenFn | null = null;

export const useSourceControlStore = create<SourceControlState>()((set, get) => ({
  ...EMPTY,
  bindApi(api) {
    if (currentUnlisten) {
      currentUnlisten();
      currentUnlisten = null;
    }
    set({ api });
    void (async () => {
      const unlisten = await api.onOperationEvent((event) => {
        const { repositoryId, operationId, kind } = event;
        if (kind === "started") {
          set((state) => {
            const existing = state.activeOperations[repositoryId] ?? [];
            if (existing.includes(operationId)) return state;
            return {
              activeOperations: {
                ...state.activeOperations,
                [repositoryId]: [...existing, operationId],
              },
            };
          });
        } else if (kind === "completed" || kind === "failed" || kind === "cancelled") {
          set((state) => {
            const existing = state.activeOperations[repositoryId] ?? [];
            const next = existing.filter((id) => id !== operationId);
            if (next.length === existing.length) return state;
            return {
              activeOperations: {
                ...state.activeOperations,
                [repositoryId]: next,
              },
            };
          });
        }
      });
      currentUnlisten = unlisten;
    })();
  },
  loadSnapshot: async (trunkId, checkout) => {
    const api = get().api ?? defaultApi;
    set((state) => ({
      loadingByTrunkId: { ...state.loadingByTrunkId, [trunkId]: true },
      errorByTrunkId: { ...state.errorByTrunkId, [trunkId]: null },
    }));
    try {
      const result = await api.getSnapshot({ scopeId: checkout.scopeId });
      applySnapshot(set, get, trunkId, result);
    } catch (error) {
      setError(set, trunkId, error);
    } finally {
      set((state) => ({
        loadingByTrunkId: { ...state.loadingByTrunkId, [trunkId]: false },
      }));
    }
  },
  refresh: async (trunkId, checkout) => {
    const api = get().api ?? defaultApi;
    set((state) => ({
      loadingByTrunkId: { ...state.loadingByTrunkId, [trunkId]: true },
      errorByTrunkId: { ...state.errorByTrunkId, [trunkId]: null },
    }));
    try {
      const result = await api.refreshLocal({ scopeId: checkout.scopeId });
      applySnapshot(set, get, trunkId, result);
    } catch (error) {
      setError(set, trunkId, error);
    } finally {
      set((state) => ({
        loadingByTrunkId: { ...state.loadingByTrunkId, [trunkId]: false },
      }));
    }
  },
  loadLog: async (trunkId, checkout, branch = null) => {
    const api = get().api ?? defaultApi;
    try {
      const input: SourceControlLogInput = {
        scopeId: checkout.scopeId,
        maxCount: 50,
        branch,
        search: null,
      };
      const entries = await api.log(input);
      set((state) => ({
        logByTrunkId: { ...state.logByTrunkId, [trunkId]: entries },
      }));
    } catch (error) {
      setError(set, trunkId, error);
      throw error;
    }
  },
  runStage: async (trunkId, checkout, input) => {
    await mutate(get, set, trunkId, checkout, (api) => api.stage(input));
  },
  runDiscard: async (trunkId, checkout, input) => {
    await mutate(get, set, trunkId, checkout, (api) => api.discard(input));
  },
  runCommit: async (trunkId, checkout, input) => {
    await mutate(get, set, trunkId, checkout, (api) => api.commit(input));
  },
  runStash: async (trunkId, checkout, input) => {
    await mutate(get, set, trunkId, checkout, (api) => api.stash(input));
  },
  runFetch: async (trunkId, checkout, input) => {
    await mutate(get, set, trunkId, checkout, (api) => api.fetch(input));
  },
  runPull: async (trunkId, checkout, input) => {
    await mutate(get, set, trunkId, checkout, (api) => api.pull(input));
  },
  runPush: async (trunkId, checkout, input) => {
    await mutate(get, set, trunkId, checkout, (api) => api.push(input));
  },
  clearTrunk: (trunkId) => {
    set((state) => {
      const snapshots = { ...state.snapshotsByTrunkId };
      const loading = { ...state.loadingByTrunkId };
      const errors = { ...state.errorByTrunkId };
      const revisions = { ...state.lastRevisionByTrunkId };
      const logs = { ...state.logByTrunkId };
      delete snapshots[trunkId];
      delete loading[trunkId];
      delete errors[trunkId];
      delete revisions[trunkId];
      delete logs[trunkId];
      return {
        snapshotsByTrunkId: snapshots,
        logByTrunkId: logs,
        loadingByTrunkId: loading,
        errorByTrunkId: errors,
        lastRevisionByTrunkId: revisions,
      };
    });
  },
}));

function applySnapshot(
  set: (
    fn: (state: SourceControlState) => Partial<SourceControlState> | SourceControlState,
    replace?: false,
  ) => void,
  get: () => SourceControlState,
  trunkId: string,
  result: SourceControlRepositorySnapshot,
): void {
  const last = get().lastRevisionByTrunkId[trunkId] ?? 0;
  if (result.revision < last) return;
  set((state) => ({
    snapshotsByTrunkId: {
      ...state.snapshotsByTrunkId,
      [trunkId]: result,
    },
    lastRevisionByTrunkId: {
      ...state.lastRevisionByTrunkId,
      [trunkId]: result.revision,
    },
  }));
}

function setError(
  set: (fn: (state: SourceControlState) => Partial<SourceControlState> | SourceControlState) => void,
  trunkId: string,
  error: unknown,
): void {
  const publicError = toPublicSourceControlError(error, "sourceControl-store");
  invalidateCheckoutRuntimeOnScopeError(trunkId, publicError);
  set((state) => ({
    errorByTrunkId: { ...state.errorByTrunkId, [trunkId]: publicError },
  }));
}

async function mutate(
  get: () => SourceControlState,
  set: (
    fn: (state: SourceControlState) => Partial<SourceControlState> | SourceControlState,
    replace?: false,
  ) => void,
  trunkId: string,
  checkout: ResolvedSourceControlCheckout,
  mutation: (api: SourceControlApi) => Promise<unknown>,
): Promise<void> {
  const api = get().api ?? defaultApi;
  try {
    await mutation(api);
    await get().refresh(trunkId, checkout);
  } catch (error) {
    setError(set, trunkId, error);
    throw error;
  }
}

export function selectSourceControlSnapshot(
  state: Pick<SourceControlState, "snapshotsByTrunkId">,
  trunkId: string,
): SourceControlRepositorySnapshot | null {
  return state.snapshotsByTrunkId[trunkId] ?? null;
}
