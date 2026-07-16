import { beforeEach, describe, expect, it } from "vitest";
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

describe("projectActivation", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useWorkspaceStore.setState({ workspacePath: null });
    useShellStore.setState({ activeMainCard: "chat" });
  });

  it("activateTrunk sets workspace and shell card from restore", () => {
    const { project, trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setTrunkRestore(trunk.id, { activeMainCard: "terminal" });
    projectActivateTrunk(trunk.id);
    expect(useWorkspaceStore.getState().workspacePath).toBe(project.folderPath);
    expect(useShellStore.getState().activeMainCard).toBe("terminal");
    expect(useProjectStore.getState().activeTrunkId).toBe(trunk.id);
  });

  it("syncs shell card changes back onto active trunk", () => {
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    projectActivateTrunk(trunk.id);
    useShellStore.getState().setActiveMainCard("editor");
    projectSyncRestoreFromShell();
    expect(
      useProjectStore.getState().trunks.find((c) => c.id === trunk.id)?.restore.activeMainCard,
    ).toBe("editor");
  });

  it("openFolder finds or creates project", () => {
    const first = projectOpenFolder("/work/app", "2026-07-10T00:00:00.000Z");
    const second = projectOpenFolder("/work/app", "2026-07-10T00:00:01.000Z");
    expect(first.project.id).toBe(second.project.id);
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  it("boot sweep uses fresh state after retention deletes active trunk", () => {
    const stale = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/stale",
      nowIso: "2026-05-01T00:00:00.000Z",
    });
    const fresh = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/current",
      nowIso: "2026-07-01T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(stale.project.id, stale.trunk.id);

    projectBootMigrateAndSweep({
      workspacePath: "/work/current",
      nowIso: "2026-07-10T00:00:00.000Z",
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
    });

    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().projects[0]?.folderPath).toBe("/work/current");
    expect(useProjectStore.getState().activeTrunkId).toBe(fresh.trunk.id);
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/current");
    expect(
      useProjectStore.getState().trunks.some((c) => c.id === stale.trunk.id),
    ).toBe(false);
  });

  it("boot does not recreate a project after the user deleted every project", () => {
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
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
