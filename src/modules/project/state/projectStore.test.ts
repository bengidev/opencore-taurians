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

  it("creates project with root chunk and sets active ids", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    expect(project.name).toBe("app");
    expect(chunk.parentChunkId).toBeNull();
    expect(useProjectStore.getState().activeProjectId).toBe(project.id);
    expect(useProjectStore.getState().activeChunkId).toBe(chunk.id);
  });

  it("adds child chunk under parent", () => {
    const { chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    expect(child?.parentChunkId).toBe(root.id);
  });

  it("pins project and chunk", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setProjectPinned(project.id, true);
    useProjectStore.getState().setChunkPinned(chunk.id, true);
    expect(useProjectStore.getState().projects.find((p) => p.id === project.id)?.pinned).toBe(
      true,
    );
    expect(useProjectStore.getState().chunks.find((c) => c.id === chunk.id)?.pinned).toBe(true);
  });

  it("deleting a chunk removes subtree and chat messages", () => {
    const { chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    useChatStore.getState().appendMessage({
      chunkId: child.id,
      role: "user",
      content: "bye",
      createdAt: "2026-07-10T00:00:02.000Z",
    });
    useProjectStore.getState().deleteChunkCascade(child.id);
    expect(useProjectStore.getState().chunks.find((c) => c.id === child.id)).toBeUndefined();
    expect(useChatStore.getState().listMessages(child.id)).toEqual([]);
  });

  it("retention sweep deletes expired unpinned data and chat", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/old",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      chunkId: chunk.id,
      role: "user",
      content: "old",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useProjectStore.setState({
      projects: [{ ...project, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
      chunks: [{ ...chunk, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
    });
    useProjectStore.getState().runRetentionSweep({
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
    });
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useChatStore.getState().listMessages(chunk.id)).toEqual([]);
  });

  it("retention sweep keeps a fresh child when its ancestor is stale", () => {
    const { project, chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Child",
      nowIso: "2026-07-01T00:00:00.000Z",
    })!;
    useProjectStore.setState({
      projects: [{ ...project, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
      chunks: [
        { ...root, lastOpenedAt: "2026-01-01T00:00:00.000Z" },
        { ...child, lastOpenedAt: "2026-07-01T00:00:00.000Z" },
      ],
    });
    useProjectStore.getState().runRetentionSweep({
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
    });
    expect(useProjectStore.getState().chunks.map((c) => c.id).sort()).toEqual(
      [root.id, child.id].sort(),
    );
  });

  it("clears workspace when the last project is deleted", () => {
    const { project } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useWorkspaceStore.getState().setWorkspace("/work/app");
    useProjectStore.getState().deleteProjectCascade(project.id);
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });

  it("finds projects by normalized folder paths", () => {
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "C:/Users/a/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    expect(
      useProjectStore.getState().findProjectByFolderPath("C:\\Users\\a\\work\\app\\"),
    ).toBeDefined();
  });
});
