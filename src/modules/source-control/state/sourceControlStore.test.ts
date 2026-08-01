import { beforeEach, describe, expect, it } from "vitest";
import { createMemorySourceControlApi } from "../api/createMemorySourceControlApi";
import type {
  SourceControlRepositorySnapshot,
  ResolvedSourceControlCheckout,
} from "../api/sourceControlContracts";
import { useSourceControlStore } from "./sourceControlStore";

const resolvedCheckout: ResolvedSourceControlCheckout = {
  kind: "project-root",
  scopeId: "scope-1",
  checkoutPath: "/work/app",
  checkoutIdentity: "checkout-1",
  repositoryIdentity: "repo-1",
  savedRefName: "main",
  managedByApp: false,
  normalizedRestore: {
    kind: "project-root",
    repositoryIdentity: "repo-1",
    savedRefName: "main",
  },
};

const baseSnapshot: SourceControlRepositorySnapshot = {
  projectId: "project-1",
  trunkId: "trunk-1",
  scopeId: "scope-1",
  checkoutPath: "/work/app",
  checkoutIdentity: "checkout-1",
  repositoryIdentity: "repo-1",
  revision: 1,
  capturedAt: "2026-07-29T00:00:00.000Z",
  repositoryState: "ready",
  worktreeLabel: "app",
  head: { kind: "branch", name: "main" },
  upstream: "origin/main",
  defaultBranch: "main",
  ahead: 0,
  behind: 0,
  files: [],
  conflictCount: 0,
  operation: null,
  remotes: [{ name: "origin", fetchUrl: "", pushUrl: "", provider: null }],
  sectionCounts: {
    changes: 0,
    stagedChanges: 0,
    stashes: 0,
    worktrees: 1,
    submodules: 0,
    lfsPatterns: 0,
  },
  capabilities: {
    gitVersion: "2.50.0",
    supportsWorktrees: true,
    lfsAvailable: false,
  },
};

function resetStore(): void {
  useSourceControlStore.setState({
    snapshotsByTrunkId: {},
    loadingByTrunkId: {},
    errorByTrunkId: {},
    lastRevisionByTrunkId: {},
    activeOperations: {},
    api: null,
  });
}

describe("sourceControlStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("loads and stores a snapshot", async () => {
    const api = createMemorySourceControlApi({
      snapshotsByCheckoutIdentity: { "checkout-1": baseSnapshot },
    });
    useSourceControlStore.getState().bindApi(api);

    await useSourceControlStore.getState().loadSnapshot("trunk-1", resolvedCheckout);

    expect(useSourceControlStore.getState().snapshotsByTrunkId["trunk-1"]?.revision).toBe(1);
    expect(useSourceControlStore.getState().lastRevisionByTrunkId["trunk-1"]).toBe(1);
    expect(useSourceControlStore.getState().errorByTrunkId["trunk-1"]).toBeNull();
  });

  it("discards a stale snapshot with an older revision", async () => {
    const fresh: SourceControlRepositorySnapshot = { ...baseSnapshot, revision: 5 };
    const api = createMemorySourceControlApi({
      snapshotsByCheckoutIdentity: { "checkout-1": fresh },
    });
    useSourceControlStore.getState().bindApi(api);
    useSourceControlStore.setState({
      snapshotsByTrunkId: { "trunk-1": { ...baseSnapshot, revision: 10 } },
      lastRevisionByTrunkId: { "trunk-1": 10 },
    });

    await useSourceControlStore.getState().loadSnapshot("trunk-1", resolvedCheckout);

    expect(useSourceControlStore.getState().snapshotsByTrunkId["trunk-1"]?.revision).toBe(10);
    expect(useSourceControlStore.getState().lastRevisionByTrunkId["trunk-1"]).toBe(10);
  });

  it("refreshes and advances the revision", async () => {
    const api = createMemorySourceControlApi({
      snapshotsByCheckoutIdentity: { "checkout-1": baseSnapshot },
    });
    useSourceControlStore.getState().bindApi(api);

    await useSourceControlStore.getState().refresh("trunk-1", resolvedCheckout);

    expect(useSourceControlStore.getState().snapshotsByTrunkId["trunk-1"]?.revision).toBe(2);
    expect(useSourceControlStore.getState().lastRevisionByTrunkId["trunk-1"]).toBe(2);
  });

  it("runs a mutation and refreshes after success", async () => {
    const api = createMemorySourceControlApi({
      snapshotsByCheckoutIdentity: { "checkout-1": baseSnapshot },
    });
    useSourceControlStore.getState().bindApi(api);
    await useSourceControlStore.getState().runStage("trunk-1", resolvedCheckout, {
      scopeId: "scope-1",
      paths: ["a.ts"],
      mode: "stage",
    });


    const calls = api.calls.map((c) => c.method);
    expect(calls).toContain("stage");
    expect(calls).toContain("refreshLocal");
    expect(useSourceControlStore.getState().snapshotsByTrunkId["trunk-1"]?.revision).toBe(2);
    expect(useSourceControlStore.getState().errorByTrunkId["trunk-1"]).toBeNull();
  });

  it("stores an error when a mutation fails", async () => {
    const api = createMemorySourceControlApi({
      snapshotsByCheckoutIdentity: { "checkout-1": baseSnapshot },
    });
    const failingApi = {
      ...api,
      stage: async () => {
        throw new Error("staging failed");
      },
    };
    useSourceControlStore.getState().bindApi(failingApi as typeof api);
    await expect(
      useSourceControlStore.getState().runStage("trunk-1", resolvedCheckout, {
        scopeId: "scope-1",
        paths: ["a.ts"],
        mode: "stage",
      }),
    ).rejects.toThrow("staging failed");


    expect(useSourceControlStore.getState().errorByTrunkId["trunk-1"]?.message).toBe(
      "staging failed",
    );
  });

  it("clearTrunk removes snapshot, loading, and error entries", async () => {
    const api = createMemorySourceControlApi({
      snapshotsByCheckoutIdentity: { "checkout-1": baseSnapshot },
    });
    useSourceControlStore.getState().bindApi(api);
    await useSourceControlStore.getState().loadSnapshot("trunk-1", resolvedCheckout);

    useSourceControlStore.getState().clearTrunk("trunk-1");

    expect(useSourceControlStore.getState().snapshotsByTrunkId["trunk-1"]).toBeUndefined();
    expect(useSourceControlStore.getState().loadingByTrunkId["trunk-1"]).toBeUndefined();
    expect(useSourceControlStore.getState().errorByTrunkId["trunk-1"]).toBeUndefined();
    expect(
      useSourceControlStore.getState().lastRevisionByTrunkId["trunk-1"],
    ).toBeUndefined();
  });

  it("tracks active operations from operation events", async () => {
    const api = createMemorySourceControlApi({
      snapshotsByCheckoutIdentity: { "checkout-1": baseSnapshot },
    });
    useSourceControlStore.getState().bindApi(api);

    api.emitOperationEvent({
      kind: "started",
      operationId: "op-1",
      repositoryId: "repo-1",
      trunkId: "trunk-1",
      phase: "fetching",
      cancellable: true,
    });

    expect(useSourceControlStore.getState().activeOperations["repo-1"]).toEqual(["op-1"]);

    api.emitOperationEvent({
      kind: "completed",
      operationId: "op-1",
      repositoryId: "repo-1",
      trunkId: "trunk-1",
      resultSummary: "done",
    });

    expect(useSourceControlStore.getState().activeOperations["repo-1"]).toEqual([]);
  });
});
