import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";
import {
  projectActivateChunk,
  projectBootMigrateAndSweep,
  projectOpenFolder,
  projectSyncRestoreFromShell,
} from "./projectActivation";

describe("projectActivation", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useWorkspaceStore.setState({ workspacePath: null });
    useShellStore.setState({ activeMainCard: "chat" });
  });

  it("activateChunk sets workspace and shell card from restore", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setChunkRestore(chunk.id, { activeMainCard: "terminal" });
    projectActivateChunk(chunk.id);
    expect(useWorkspaceStore.getState().workspacePath).toBe(project.folderPath);
    expect(useShellStore.getState().activeMainCard).toBe("terminal");
    expect(useProjectStore.getState().activeChunkId).toBe(chunk.id);
  });

  it("syncs shell card changes back onto active chunk", () => {
    const { chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    projectActivateChunk(chunk.id);
    useShellStore.getState().setActiveMainCard("editor");
    projectSyncRestoreFromShell();
    expect(
      useProjectStore.getState().chunks.find((c) => c.id === chunk.id)?.restore.activeMainCard,
    ).toBe("editor");
  });

  it("openFolder finds or creates project", () => {
    const first = projectOpenFolder("/work/app", "2026-07-10T00:00:00.000Z");
    const second = projectOpenFolder("/work/app", "2026-07-10T00:00:01.000Z");
    expect(first.project.id).toBe(second.project.id);
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  it("boot sweep uses fresh state after retention deletes active chunk", () => {
    const stale = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/stale",
      nowIso: "2026-05-01T00:00:00.000Z",
    });
    const fresh = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/current",
      nowIso: "2026-07-01T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(stale.project.id, stale.chunk.id);

    projectBootMigrateAndSweep({
      workspacePath: "/work/current",
      nowIso: "2026-07-10T00:00:00.000Z",
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
    });

    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().projects[0]?.folderPath).toBe("/work/current");
    expect(useProjectStore.getState().activeChunkId).toBe(fresh.chunk.id);
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/current");
    expect(
      useProjectStore.getState().chunks.some((c) => c.id === stale.chunk.id),
    ).toBe(false);
  });

  it("boot does not recreate a project after the user deleted every project", () => {
    const { project } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useWorkspaceStore.getState().setWorkspace("/work/app");
    useProjectStore.getState().deleteProjectCascade(project.id);

    projectBootMigrateAndSweep({
      workspacePath: useWorkspaceStore.getState().workspacePath,
      nowIso: "2026-07-10T00:00:01.000Z",
      nowMs: Date.parse("2026-07-10T00:00:01.000Z"),
    });

    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });
});
