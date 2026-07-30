import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(
    async (_eventName: string, _handler: (event: { payload: unknown }) => void) => () => {},
  ),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));

import { createMemoryGitApi } from "./createMemoryGitApi";
import { createTauriGitApi } from "./gitApi";
import type {
  GitOperationEvent,
  GitRepositorySnapshot,
  GitResolveCheckoutInput,
  GitResolveCheckoutResult,
} from "./gitContracts";

const resolveInput: GitResolveCheckoutInput = {
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
  checkoutPath: "/work/app",
  checkoutIdentity: "checkout-1",
  repositoryIdentity: "repo-1",
  savedRefName: "main",
  managedByApp: false,
  normalizedRestore: {
    kind: "project-root" as const,
    repositoryIdentity: "repo-1",
    savedRefName: "main",
  },
};

const snapshot: GitRepositorySnapshot = {
  projectId: "project-1",
  trunkId: "trunk-1",
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

describe("createTauriGitApi", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockClear();
  });

  it("serializes checkout resolution as a task-level command", async () => {
    const result: GitResolveCheckoutResult = {
      status: "ready",
      checkout: resolvedCheckout,
    };
    invokeMock.mockResolvedValue(result);

    const api = createTauriGitApi();
    await expect(api.resolveCheckout(resolveInput)).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith("git_resolve_checkout", {
      input: resolveInput,
    });
  });

  it("serializes snapshot, local refresh, initialize, and diff commands", async () => {
    invokeMock
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({
        source: { kind: "working-tree" },
        patch: "diff --git a/a.ts b/a.ts",
        files: [],
        additions: 1,
        deletions: 0,
        binary: false,
        truncated: false,
      });

    const api = createTauriGitApi();
    await api.getSnapshot({ projectId: "project-1", trunkId: "trunk-1", checkout: resolvedCheckout });
    await api.refreshLocal({ projectId: "project-1", trunkId: "trunk-1", checkout: resolvedCheckout });
    await api.initialize({ projectId: "project-1", trunkId: "trunk-1", checkoutPath: "/work/app" });
    await api.getDiff({
      projectId: "project-1",
      trunkId: "trunk-1",
      checkout: resolvedCheckout,
      source: { kind: "working-tree" },
      ignoreWhitespace: false,
      maxBytes: 1_048_576,
    });

    expect(invokeMock.mock.calls.map(([command]) => command)).toEqual([
      "git_get_snapshot",
      "git_refresh",
      "git_initialize",
      "git_get_diff",
    ]);
  });

  it("subscribes to sanitized operation events", async () => {
    const api = createTauriGitApi();
    const callback = vi.fn<(event: GitOperationEvent) => void>();
    await api.onOperationEvent(callback);

    expect(listenMock).toHaveBeenCalledWith("git://operation", expect.any(Function));
    const handler = listenMock.mock.calls[0]?.[1] as
      | ((event: { payload: GitOperationEvent }) => void)
      | undefined;
    const event: GitOperationEvent = {
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

describe("createMemoryGitApi", () => {
  it("records task-level calls and advances revisions deterministically", async () => {
    const api = createMemoryGitApi({
      resolveByTrunkId: {
        "trunk-1": { status: "ready", checkout: resolvedCheckout },
      },
      snapshotsByCheckoutIdentity: { "checkout-1": snapshot },
    });

    await expect(api.resolveCheckout(resolveInput)).resolves.toEqual({
      status: "ready",
      checkout: resolvedCheckout,
    });
    await expect(
      api.refreshLocal({
        projectId: "project-1",
        trunkId: "trunk-1",
        checkout: resolvedCheckout,
      }),
    ).resolves.toMatchObject({ revision: 2 });
    expect(api.calls.map((call) => call.method)).toEqual([
      "resolveCheckout",
      "refreshLocal",
    ]);
  });

  it("exposes no arbitrary command execution method", () => {
    const api = createMemoryGitApi();
    expect("run" in api).toBe(false);
    expect("exec" in api).toBe(false);
    expect("command" in api).toBe(false);
  });
});
