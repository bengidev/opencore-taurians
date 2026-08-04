import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useProjectStore } from "../../project/state/projectStore";
import { useSourceControlStore } from "../state/sourceControlStore";
import { createMemorySourceControlApi } from "../api/sourceControlMemoryApi";
import type {
  SourceControlFileStatus,
  SourceControlRepositorySnapshot,
  ResolvedSourceControlCheckout,
} from "../api/sourceControlContracts";
import { SourceControlPanel } from "./SourceControlPanel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
}));

const CHECKOUT: ResolvedSourceControlCheckout = {
  kind: "project-root",
  scopeId: "scope-1",
  checkoutPath: "/work/app",
  checkoutIdentity: "checkout:/work/app",
  repositoryIdentity: "repository:/work/app",
  savedRefName: "main",
  managedByApp: false,
  normalizedRestore: {
    kind: "project-root",
    repositoryIdentity: "repository:/work/app",
    savedRefName: "main",
  },
};

function makeSnapshot(
  overrides: Partial<SourceControlRepositorySnapshot> = {},
): SourceControlRepositorySnapshot {
  return {
    projectId: "project-1",
    trunkId: "trunk-1",
    scopeId: "scope-1",
    checkoutPath: "/work/app",
    checkoutIdentity: CHECKOUT.checkoutIdentity,
    repositoryIdentity: "repository:/work/app",
    revision: 1,
    capturedAt: "2026-07-30T00:00:00.000Z",
    repositoryState: "ready",
    worktreeLabel: "main",
    head: { kind: "branch", name: "main" },
    upstream: "origin/main",
    defaultBranch: "main",
    ahead: 0,
    behind: 0,
    files: [],
    conflictCount: 0,
    operation: null,
    remotes: [{ name: "origin", fetchUrl: "https://example.com", pushUrl: "https://example.com", provider: null }],
    sectionCounts: {
      changes: 0,
      stagedChanges: 0,
      stashes: 0,
      worktrees: 0,
      submodules: 0,
      lfsPatterns: 0,
    },
    capabilities: { gitVersion: "2.40", supportsWorktrees: true, lfsAvailable: false },
    ...overrides,
  };
}

const changedFile: SourceControlFileStatus = {
  path: "src/a.ts",
  oldPath: null,
  indexStatus: null,
  worktreeStatus: "modified",
  conflictStatus: null,
  additions: 3,
  deletions: 1,
  binary: false,
  submodule: false,
  lfsPointer: false,
};

const stagedFile: SourceControlFileStatus = {
  path: "src/b.ts",
  oldPath: null,
  indexStatus: "modified",
  worktreeStatus: null,
  conflictStatus: null,
  additions: 2,
  deletions: 0,
  binary: false,
  submodule: false,
  lfsPointer: false,
};

const dualPathFile: SourceControlFileStatus = {
  path: "src/shared.ts",
  oldPath: null,
  indexStatus: "modified",
  worktreeStatus: "modified",
  conflictStatus: null,
  additions: 4,
  deletions: 2,
  binary: false,
  submodule: false,
  lfsPointer: false,
};

describe("SourceControlPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useSourceControlStore.setState({
      snapshotsByTrunkId: {},
      loadingByTrunkId: {},
      errorByTrunkId: {},
      lastRevisionByTrunkId: {},
      activeOperations: {},
      api: null,
    });
  });

  function setupTrunk(
    snapshot?: SourceControlRepositorySnapshot,
    runtimeStatus: "ready" | "invalid" | "resolving" | "unresolved" = "ready",
  ) {
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-30T00:00:00.000Z",
      trunkId: "trunk-1",
      projectId: "project-1",
    });
    if (runtimeStatus === "ready") {
      useProjectStore.getState().setCheckoutRuntime(trunk.id, {
        status: "ready",
        checkout: CHECKOUT,
      });
    } else if (runtimeStatus === "invalid") {
      useProjectStore.getState().setCheckoutRuntime(trunk.id, {
        status: "invalid",
        safeWorkspacePath: "/work/app",
        reason: "missing-worktree",
        message: "The saved worktree no longer exists.",
        worktreePath: null,
        repositoryIdentity: null,
        savedRefName: null,
      });
    } else {
      useProjectStore.getState().setCheckoutRuntime(trunk.id, {
        status: runtimeStatus,
      });
    }
    const seed = snapshot
      ? { snapshotsByCheckoutIdentity: { [CHECKOUT.checkoutIdentity]: snapshot } }
      : {};
    const sourceControlApi = createMemorySourceControlApi(seed);
    useSourceControlStore.getState().bindApi(sourceControlApi);
    // Pre-seed the store so the panel renders with the snapshot already present
    // (loadSnapshot is async and would otherwise race the first render).
    if (snapshot) {
      useSourceControlStore.setState((state) => ({
        snapshotsByTrunkId: { ...state.snapshotsByTrunkId, [trunk.id]: snapshot },
        lastRevisionByTrunkId: { ...state.lastRevisionByTrunkId, [trunk.id]: snapshot.revision },
      }));
    }
    return { sourceControlApi, trunk };
  }

  it("prompts to select a trunk when none is active", () => {
    render(<SourceControlPanel />);
    expect(
      screen.getByText("Select a trunk to view source control."),
    ).toBeInTheDocument();
  });

  it("flips trunk runtime to invalid when loadSnapshot returns checkout-invalid", async () => {
    const typedError = {
      code: "checkout-invalid" as const,
      operation: "git_get_snapshot",
      message: "Scope is no longer valid",
      retryable: false,
    };
    const { trunk } = setupTrunk(undefined, "ready");
    const failingApi = {
      ...createMemorySourceControlApi({}),
      getSnapshot: async () => {
        throw typedError;
      },
    };
    useSourceControlStore.getState().bindApi(failingApi);

    render(<SourceControlPanel sourceControlApi={failingApi} />);

    await waitFor(() => {
      expect(
        screen.getByText("The saved checkout is no longer valid."),
      ).toBeInTheDocument();
    });
    expect(useProjectStore.getState().checkoutRuntimeByTrunkId[trunk.id]).toMatchObject({
      status: "invalid",
      message: "Scope is no longer valid",
    });
  });

  it("shows the invalid-checkout message when runtime is invalid", () => {
    setupTrunk(undefined, "invalid");
    render(<SourceControlPanel />);
    expect(
      screen.getByText("The saved checkout is no longer valid."),
    ).toBeInTheDocument();
  });

  it("shows not-a-repository state with an initialize button", () => {
    const snapshot = makeSnapshot({ repositoryState: "not-repository" });
    setupTrunk(snapshot);
    render(<SourceControlPanel />);
    expect(screen.getByText("Not a SourceControl repository.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Initialize repository" }),
    ).toBeInTheDocument();
  });

  it("shows source control unavailable state", () => {
    const snapshot = makeSnapshot({ repositoryState: "git-unavailable" });
    setupTrunk(snapshot);
    render(<SourceControlPanel />);
    expect(
      screen.getByText("Git is not installed on this system."),
    ).toBeInTheDocument();
  });

  it("renders the Changes section with a changed file and stage action", () => {
    const snapshot = makeSnapshot({
      files: [changedFile],
      sectionCounts: { ...makeSnapshot().sectionCounts, changes: 1 },
    });
    setupTrunk(snapshot);
    render(<SourceControlPanel />);

    expect(screen.getByText("src/a.ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stage" })).toBeInTheDocument();
  });

  it("stages a file when its stage button is clicked", async () => {
    const snapshot = makeSnapshot({
      files: [changedFile],
      sectionCounts: { ...makeSnapshot().sectionCounts, changes: 1 },
    });
    const { sourceControlApi } = setupTrunk(snapshot);
    const user = userEvent.setup();
    render(<SourceControlPanel sourceControlApi={sourceControlApi} />);

    await user.click(screen.getByRole("button", { name: "Stage" }));

    await waitFor(() => {
      expect(sourceControlApi.calls.find((c) => c.method === "stage")).toBeDefined();
    });
    const stageCall = sourceControlApi.calls.find((c) => c.method === "stage");
    expect(stageCall?.input).toMatchObject({
      scopeId: "scope-1",
      paths: ["src/a.ts"],
      mode: "stage",
    });
  });

  it("shows the inline commit textarea and button when there are staged files", () => {
    const snapshot = makeSnapshot({
      files: [stagedFile],
      sectionCounts: { ...makeSnapshot().sectionCounts, stagedChanges: 1 },
    });
    const { sourceControlApi } = setupTrunk(snapshot);
    render(<SourceControlPanel sourceControlApi={sourceControlApi} />);

    expect(screen.getByPlaceholderText(/Message/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("shows fetch/pull/push toolbar in the header", () => {
    setupTrunk(makeSnapshot());
    render(<SourceControlPanel />);

    expect(screen.getByRole("button", { name: "Fetch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push" })).toBeInTheDocument();
  });

  it("shows ahead/behind when upstream is set", () => {
    const snapshot = makeSnapshot({ ahead: 2, behind: 1 });
    setupTrunk(snapshot);
    render(<SourceControlPanel />);

    expect(screen.getByText(/↑2/)).toBeInTheDocument();
    expect(screen.getByText(/↓1/)).toBeInTheDocument();
  });

  it("expands working-tree and staged diffs independently for the same path", async () => {
    const snapshot = makeSnapshot({
      files: [dualPathFile],
      sectionCounts: {
        ...makeSnapshot().sectionCounts,
        changes: 1,
        stagedChanges: 1,
      },
    });
    const { sourceControlApi } = setupTrunk(snapshot);
    const user = userEvent.setup();
    render(<SourceControlPanel sourceControlApi={sourceControlApi} />);

    const pathButtons = screen.getAllByRole("button", { name: "src/shared.ts" });
    expect(pathButtons).toHaveLength(2);

    await user.click(pathButtons[0]);
    await waitFor(() => {
      expect(sourceControlApi.calls.filter((c) => c.method === "getDiff")).toHaveLength(1);
    });
    expect(sourceControlApi.calls.find((c) => c.method === "getDiff")?.input).toMatchObject({
      source: { kind: "working-tree" },
      pathspec: "src/shared.ts",
    });
    expect(pathButtons[0]).toHaveAttribute("aria-expanded", "true");
    expect(pathButtons[1]).toHaveAttribute("aria-expanded", "false");

    await user.click(pathButtons[1]);
    await waitFor(() => {
      expect(sourceControlApi.calls.filter((c) => c.method === "getDiff")).toHaveLength(2);
    });
    expect(sourceControlApi.calls.at(-1)?.input).toMatchObject({
      source: { kind: "staged" },
      pathspec: "src/shared.ts",
    });
    expect(pathButtons[0]).toHaveAttribute("aria-expanded", "false");
    expect(pathButtons[1]).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps cached diffs when snapshot revision changes", async () => {
    const snapshot = makeSnapshot({
      files: [changedFile],
      sectionCounts: { ...makeSnapshot().sectionCounts, changes: 1 },
    });
    const { sourceControlApi, trunk } = setupTrunk(snapshot);
    const user = userEvent.setup();
    render(<SourceControlPanel sourceControlApi={sourceControlApi} />);

    const pathButton = screen.getByRole("button", { name: "src/a.ts" });
    await user.click(pathButton);
    await waitFor(() => {
      expect(sourceControlApi.calls.filter((c) => c.method === "getDiff")).toHaveLength(1);
    });

    // Bump revision (simulating a background refresh) — the diff stays open.
    useSourceControlStore.setState((state) => ({
      snapshotsByTrunkId: {
        ...state.snapshotsByTrunkId,
        [trunk.id]: { ...snapshot, revision: snapshot.revision + 1 },
      },
      lastRevisionByTrunkId: {
        ...state.lastRevisionByTrunkId,
        [trunk.id]: snapshot.revision + 1,
      },
    }));

    // The diff row should still be expanded.
    expect(pathButton).toHaveAttribute("aria-expanded", "true");

    // Clicking again toggles the diff closed without a new getDiff call.
    await user.click(pathButton);
    expect(pathButton).toHaveAttribute("aria-expanded", "false");
    expect(sourceControlApi.calls.filter((c) => c.method === "getDiff")).toHaveLength(1);
  });

  it("collapses the diff when the file disappears from the changed list", async () => {
    const snapshot = makeSnapshot({
      files: [changedFile],
      sectionCounts: { ...makeSnapshot().sectionCounts, changes: 1 },
    });
    const { sourceControlApi, trunk } = setupTrunk(snapshot);
    const user = userEvent.setup();
    render(<SourceControlPanel sourceControlApi={sourceControlApi} />);

    const pathButton = screen.getByRole("button", { name: "src/a.ts" });
    await user.click(pathButton);
    await waitFor(() => {
      expect(sourceControlApi.calls.filter((c) => c.method === "getDiff")).toHaveLength(1);
    });
    expect(pathButton).toHaveAttribute("aria-expanded", "true");

    // Simulate staging the file — it vanishes from changedFiles and moves to stagedFiles.
    useSourceControlStore.setState((state) => ({
      snapshotsByTrunkId: {
        ...state.snapshotsByTrunkId,
        [trunk.id]: {
          ...snapshot,
          revision: snapshot.revision + 1,
          files: [{ ...changedFile, indexStatus: "modified", worktreeStatus: null }],
          sectionCounts: { ...snapshot.sectionCounts, changes: 0, stagedChanges: 1 },
        },
      },
      lastRevisionByTrunkId: {
        ...state.lastRevisionByTrunkId,
        [trunk.id]: snapshot.revision + 1,
      },
    }));

    // Wait for the effect to fire and collapse the diff.
    await waitFor(() => {
      // After state update, the old button is removed. Query for the new one in Staged.
      // The diff should be collapsed (aria-expanded=false) in its new location.
      const stagedButton = screen.getByRole("button", { name: "src/a.ts" });
      expect(stagedButton).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("clears cached diffs when checkout scope changes", async () => {
    const snapshot = makeSnapshot({
      files: [changedFile],
      sectionCounts: { ...makeSnapshot().sectionCounts, changes: 1 },
    });
    const { sourceControlApi, trunk } = setupTrunk(snapshot);
    const user = userEvent.setup();
    render(<SourceControlPanel sourceControlApi={sourceControlApi} />);

    const pathButton = screen.getByRole("button", { name: "src/a.ts" });
    await user.click(pathButton);
    await waitFor(() => {
      expect(sourceControlApi.calls.filter((c) => c.method === "getDiff")).toHaveLength(1);
    });

    useProjectStore.getState().setCheckoutRuntime(trunk.id, {
      status: "ready",
      checkout: { ...CHECKOUT, scopeId: "scope-2" },
    });

    await user.click(pathButton);
    await user.click(pathButton);
    await waitFor(() => {
      expect(sourceControlApi.calls.filter((c) => c.method === "getDiff")).toHaveLength(2);
    });
    expect(sourceControlApi.calls.at(-1)?.input).toMatchObject({
      scopeId: "scope-2",
      source: { kind: "working-tree" },
    });
  });
});
