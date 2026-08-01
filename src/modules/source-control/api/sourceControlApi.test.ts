import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(
    async (_eventName: string, _handler: (event: { payload: unknown }) => void) => () => {},
  ),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

import { createMemorySourceControlApi } from "./createMemorySourceControlApi";
import { createTauriSourceControlApi } from "./sourceControlApi";
import type {
  SourceControlOperationEvent,
  SourceControlRepositorySnapshot,
  SourceControlResolveCheckoutInput,
  SourceControlResolveCheckoutResult,
} from "./sourceControlContracts";

const resolveInput: SourceControlResolveCheckoutInput = {
  projectId: "project-1",
  trunkId: "trunk-1",
  projectFolderPath: "/work/app",
  gitCheckout: {
    kind: "project-root",
    repositoryIdentity: null,
    savedRefName: null,
  },
};

const resolvedCheckout = {
  kind: "project-root" as const,
  scopeId: "scope-1",
  checkoutPath: "/work/app",
  repositoryIdentity: "repo-1",
  savedRefName: "main",
  managedByApp: false,
  normalizedRestore: {
    kind: "project-root" as const,
    repositoryIdentity: "repo-1",
    savedRefName: "main",
  },
};

const snapshot: SourceControlRepositorySnapshot = {
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
  remotes: [],
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

describe("createTauriSourceControlApi", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockClear();
  });

  it("serializes checkout resolution as a task-level command", async () => {
    const result: SourceControlResolveCheckoutResult = {
      status: "ready",
      checkout: resolvedCheckout,
    };
    invokeMock.mockResolvedValue(result);

    const api = createTauriSourceControlApi();
    await expect(api.resolveCheckout(resolveInput)).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("git_resolve_checkout", {
      input: resolveInput,
    });
  });

  it("serializes snapshot, local refresh, initialize, and diff commands with scope IDs only", async () => {
    invokeMock
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({
        source: { kind: "working-tree" },
        patch: "diff --sourceControl a/a.ts b/a.ts",
        files: [],
        additions: 1,
        deletions: 0,
        binary: false,
        truncated: false,
      });

    const api = createTauriSourceControlApi();
    await api.getSnapshot({ scopeId: "scope-1" });
    await api.refreshLocal({ scopeId: "scope-1" });
    await api.initialize({ scopeId: "scope-1" });
    await api.getDiff({
      scopeId: "scope-1",
      source: { kind: "working-tree" },
      ignoreWhitespace: false,
      maxBytes: 1_048_576,
      pathspec: null,
    });

    expect(invokeMock.mock.calls.map(([command]) => command)).toEqual([
      "git_get_snapshot",
      "git_refresh",
      "git_initialize",
      "git_get_diff",
    ]);
    for (const [, payload] of invokeMock.mock.calls) {
      expect(JSON.stringify(payload)).not.toContain("checkoutPath");
      expect(JSON.stringify(payload)).toContain("scopeId");
    }
  });
  it("serializes operation inputs with scope IDs and no checkout path authority", async () => {
    const api = createTauriSourceControlApi();
    const inputs = [
      ["stage", { scopeId: "scope-1", paths: ["a.ts"], mode: "stage" }],
      ["discard", { scopeId: "scope-1", paths: ["a.ts"], mode: "tracked" }],
      [
        "commit",
        {
          scopeId: "scope-1",
          subject: "subject",
          body: "",
          amend: false,
          signoff: false,
          newBranch: null,
          selectedPaths: null,
        },
      ],
      ["stash", { scopeId: "scope-1", message: null, includeUntracked: false, action: { kind: "create" } }],
      ["fetch", { scopeId: "scope-1", prune: false, remote: null }],
      ["pull", { scopeId: "scope-1", strategy: "ff-only", rebase: false }],
      [
        "push",
        { scopeId: "scope-1", remote: null, refspec: null, setUpstream: false, forceWithLease: null },
      ],
      ["mutateRef", { scopeId: "scope-1", action: "checkout", name: "main", target: null, force: false }],
      ["log", { scopeId: "scope-1", maxCount: 10, branch: null, search: null }],
      ["compare", { scopeId: "scope-1", base: "main", head: "HEAD" }],
    ] as const;
    for (const [method, input] of inputs) {
      await api[method as keyof typeof api](input as never);
      const payload = invokeMock.mock.calls.at(-1)?.[1];
      expect(JSON.stringify(payload)).not.toContain("checkoutPath");
      expect(JSON.stringify(payload)).toContain("scopeId");
    }
  });

  it("serializes scoped clone, submodule, LFS, refs, and hooks operations", async () => {
    const api = createTauriSourceControlApi();
    await api.clone({
      scopeId: "scope-1",
      url: "https://example.com/repo.git",
      destinationName: "repo",
      branch: null,
      recurseSubmodules: false,
    });
    await api.submodule({ scopeId: "scope-1", action: "status", recursive: false });
    await api.lfs({ scopeId: "scope-1", action: "status", patterns: [] });
    await api.listRefs({ scopeId: "scope-1" });
    await api.enumerateHooks({ scopeId: "scope-1" });
    for (const [, payload] of invokeMock.mock.calls) {
      expect(JSON.stringify(payload)).not.toContain("checkoutPath");
      expect(JSON.stringify(payload)).toContain("scopeId");
    }
  });

  it("subscribes to sanitized operation events", async () => {
    const api = createTauriSourceControlApi();
    const callback = vi.fn<(event: SourceControlOperationEvent) => void>();
    await api.onOperationEvent(callback);

    expect(listenMock).toHaveBeenCalledWith("sourceControl://operation", expect.any(Function));
    const handler = listenMock.mock.calls[0]?.[1] as
      | ((event: { payload: SourceControlOperationEvent }) => void)
      | undefined;
    const event: SourceControlOperationEvent = {
      kind: "progress",
      operationId: "op-1",
      repositoryId: "repo-1",
      trunkId: "trunk-1",
      phase: "fetching",
      message: "Receiving objects",
      cancellable: true,
      completed: 1,
      total: 2,
    };
    handler?.({ payload: event });
    expect(callback).toHaveBeenCalledWith(event);
  });
});

describe("createMemorySourceControlApi", () => {
  it("records task-level calls and advances revisions deterministically", async () => {
    const api = createMemorySourceControlApi({
      resolveByTrunkId: {
        "trunk-1": { status: "ready", checkout: resolvedCheckout },
      },
      snapshotsByCheckoutIdentity: { "checkout-1": snapshot },
    });

    await expect(api.resolveCheckout(resolveInput)).resolves.toEqual({
      status: "ready",
      checkout: resolvedCheckout,
    });
    await expect(api.refreshLocal({ scopeId: "scope-1" })).resolves.toMatchObject({ revision: 2 });
    expect(api.calls.map((call) => call.method)).toEqual([
      "resolveCheckout",
      "refreshLocal",
    ]);
  });

  it("exposes no arbitrary command execution method", () => {
    const api = createMemorySourceControlApi();
    expect("run" in api).toBe(false);
    expect("exec" in api).toBe(false);
    expect("command" in api).toBe(false);
  });
});
