import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySourceControlApi } from "../../source-control";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";
import {
  projectActivateTrunk,
  projectBootMigrateAndSweep,
  projectOpenFolder,
  projectSyncRestoreFromShell,
} from "./projectActivation";

function readyCheckout(path: string, repositoryIdentity = "repo-1") {
  return {
    status: "ready" as const,
    checkout: {
      kind: "project-root" as const,
      checkoutPath: path,
      checkoutIdentity: `checkout:${path}`,
      repositoryIdentity,
      savedRefName: "main",
      managedByApp: false,
      normalizedRestore: {
        kind: "project-root" as const,
        repositoryIdentity,
        savedRefName: "main",
      },
    },
  };
}

describe("projectActivation", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useWorkspaceStore.setState({ workspacePath: null });
    useShellStore.setState({ activeMainCard: "chat" });
  });

  it("activates the validated checkout and restores the shell card", async () => {
    const { project, trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setTrunkActiveMainCard(trunk.id, "terminal");
    const api = createMemorySourceControlApi({
      resolveByTrunkId: { [trunk.id]: readyCheckout("/canonical/work/app") },
    });

    await projectActivateTrunk(trunk.id, { sourceControlApi: api });

    expect(useWorkspaceStore.getState().workspacePath).toBe("/canonical/work/app");
    expect(useShellStore.getState().activeMainCard).toBe("terminal");
    expect(useProjectStore.getState().activeTrunkId).toBe(trunk.id);
    expect(api.calls[0]).toMatchObject({
      method: "resolveCheckout",
      input: { projectId: project.id, trunkId: trunk.id },
    });
  });

  it("keeps Files on the project root when checkout validation fails", async () => {
    const { project, trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const api = createMemorySourceControlApi({
      resolveByTrunkId: {
        [trunk.id]: {
          status: "invalid",
          reason: "missing-worktree",
          message: "missing",
          worktreePath: "/missing",
          repositoryIdentity: "repo-1",
          savedRefName: "feature/x",
        },
      },
    });

    await expect(projectActivateTrunk(trunk.id, { sourceControlApi: api })).resolves.toEqual({
      status: "checkout-invalid",
      reason: "missing-worktree",
    });
    expect(useWorkspaceStore.getState().workspacePath).toBe(project.folderPath);
    expect(useProjectStore.getState().checkoutRuntimeByTrunkId[trunk.id]).toMatchObject({
      status: "invalid",
      safeWorkspacePath: project.folderPath,
    });
  });

  it("does not allow a stale activation to overwrite a newer trunk", async () => {
    const first = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/first",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const second = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/second",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    let resolveFirst!: (value: ReturnType<typeof readyCheckout>) => void;
    const firstApi = {
      resolveCheckout: vi.fn(
        () =>
          new Promise<ReturnType<typeof readyCheckout>>((resolve) => {
            resolveFirst = resolve;
          }),
      ),
    };
    const secondApi = createMemorySourceControlApi({
      resolveByTrunkId: {
        [second.trunk.id]: readyCheckout("/canonical/second", "repo-2"),
      },
    });

    const firstActivation = projectActivateTrunk(first.trunk.id, { sourceControlApi: firstApi });
    await projectActivateTrunk(second.trunk.id, { sourceControlApi: secondApi });
    resolveFirst(readyCheckout("/canonical/first"));

    await expect(firstActivation).resolves.toEqual({ status: "superseded" });
    expect(useWorkspaceStore.getState().workspacePath).toBe("/canonical/second");
  });

  it("syncs shell card changes back onto active trunk", async () => {
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const api = createMemorySourceControlApi({
      resolveByTrunkId: { [trunk.id]: readyCheckout("/work/app") },
    });
    await projectActivateTrunk(trunk.id, { sourceControlApi: api });
    useShellStore.getState().setActiveMainCard("editor");
    projectSyncRestoreFromShell();
    expect(
      useProjectStore.getState().trunks.find((item) => item.id === trunk.id)?.restore
        .activeMainCard,
    ).toBe("editor");
  });

  it("openFolder finds or creates project", async () => {
    const firstApi = createMemorySourceControlApi();
    const createResolve = vi.spyOn(firstApi, "resolveCheckout").mockResolvedValue(
      readyCheckout("/work/app"),
    );
    const first = await projectOpenFolder(
      "/work/app",
      "2026-07-10T00:00:00.000Z",
      firstApi,
    );
    const second = await projectOpenFolder(
      "/work/app",
      "2026-07-10T00:00:01.000Z",
      firstApi,
    );
    expect(createResolve).toHaveBeenCalledTimes(2);
    expect(first.project.id).toBe(second.project.id);
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  it("boot sweep uses fresh state after retention deletes active trunk", async () => {
    const stale = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/stale",
      nowIso: "2026-05-01T00:00:00.000Z",
    });
    const fresh = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/current",
      nowIso: "2026-07-01T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(stale.project.id, stale.trunk.id);
    const api = createMemorySourceControlApi({
      resolveByTrunkId: { [fresh.trunk.id]: readyCheckout("/work/current") },
    });

    await projectBootMigrateAndSweep({
      workspacePath: "/work/current",
      nowIso: "2026-07-10T00:00:00.000Z",
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
      sourceControlApi: api,
    });

    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().activeTrunkId).toBe(fresh.trunk.id);
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/current");
  });

  it("boot does not recreate a project after the user deleted every project", async () => {
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useWorkspaceStore.getState().setWorkspace("/work/app");
    useProjectStore.getState().deleteProjectCascade(project.id);

    await projectBootMigrateAndSweep({
      workspacePath: useWorkspaceStore.getState().workspacePath,
      nowIso: "2026-07-10T00:00:01.000Z",
      nowMs: Date.parse("2026-07-10T00:00:01.000Z"),
    });

    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });
});
