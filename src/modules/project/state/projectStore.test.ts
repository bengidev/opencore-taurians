import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useChatStore } from "../../chat/state/chatStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";

describe("projectStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useChatStore.getState().resetChat();
    useWorkspaceStore.setState({ workspacePath: null });
  });

  it("creates project with root trunk and sets active ids", () => {
    const { project, trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    expect(project.name).toBe("app");
    expect(trunk.parentTrunkId).toBeNull();
    expect(useProjectStore.getState().activeProjectId).toBe(project.id);
    expect(useProjectStore.getState().activeTrunkId).toBe(trunk.id);
  });

  it("adds child trunk under parent", () => {
    const { trunk: root } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildTrunk({
      parentTrunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    expect(child?.parentTrunkId).toBe(root.id);
  });

  it("rejects child trunk under a non-root parent", () => {
    const { trunk: root } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildTrunk({
      parentTrunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    expect(
      useProjectStore.getState().addChildTrunk({
        parentTrunkId: child.id,
        title: "Grandchild",
        nowIso: "2026-07-10T00:00:02.000Z",
      }),
    ).toBeNull();
  });

  it("pins project and trunk", () => {
    const { project, trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setProjectPinned(project.id, true);
    useProjectStore.getState().setTrunkPinned(trunk.id, true);
    expect(useProjectStore.getState().projects.find((p) => p.id === project.id)?.pinned).toBe(
      true,
    );
    expect(useProjectStore.getState().trunks.find((c) => c.id === trunk.id)?.pinned).toBe(true);
  });

  it("deleting a trunk removes subtree and chat messages", () => {
    const { trunk: root } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildTrunk({
      parentTrunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    useChatStore.getState().appendMessage({
      trunkId: child.id,
      role: "user",
      content: "bye",
      createdAt: "2026-07-10T00:00:02.000Z",
    });
    useProjectStore.getState().deleteTrunkCascade(child.id);
    expect(useProjectStore.getState().trunks.find((c) => c.id === child.id)).toBeUndefined();
    expect(useChatStore.getState().listMessages(child.id)).toEqual([]);
  });

  it("retention sweep deletes expired unpinned data and chat", () => {
    const { project, trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/old",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      trunkId: trunk.id,
      role: "user",
      content: "old",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useProjectStore.setState({
      projects: [{ ...project, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
      trunks: [{ ...trunk, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
    });
    useProjectStore.getState().runRetentionSweep({
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
    });
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useChatStore.getState().listMessages(trunk.id)).toEqual([]);
  });

  it("retention sweep keeps a fresh child when its ancestor is stale", () => {
    const { project, trunk: root } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildTrunk({
      parentTrunkId: root.id,
      title: "Child",
      nowIso: "2026-07-01T00:00:00.000Z",
    })!;
    useProjectStore.setState({
      projects: [{ ...project, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
      trunks: [
        { ...root, lastOpenedAt: "2026-01-01T00:00:00.000Z" },
        { ...child, lastOpenedAt: "2026-07-01T00:00:00.000Z" },
      ],
    });
    useProjectStore.getState().runRetentionSweep({
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
    });
    expect(useProjectStore.getState().trunks.map((c) => c.id).sort()).toEqual(
      [root.id, child.id].sort(),
    );
  });

  it("clears workspace when the last project is deleted", () => {
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useWorkspaceStore.getState().setWorkspace("/work/app");
    useProjectStore.getState().deleteProjectCascade(project.id);
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });

  it("finds projects by normalized folder paths", () => {
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "C:/Users/a/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    expect(
      useProjectStore.getState().findProjectByFolderPath("C:\\Users\\a\\work\\app\\"),
    ).toBeDefined();
  });
});
