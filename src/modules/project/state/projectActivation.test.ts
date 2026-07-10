import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";
import {
  projectActivateChunk,
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
});
