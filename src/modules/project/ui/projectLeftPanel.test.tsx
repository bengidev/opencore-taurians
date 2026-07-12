import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "../../chat/state/chatStore";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { createMemoryFolderPicker } from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "../state/projectStore";
import { ProjectLeftPanel } from "./projectLeftPanel";

function createDataTransfer() {
  const store = new Map<string, string>();
  return {
    effectAllowed: "none" as DataTransfer["effectAllowed"],
    dropEffect: "none" as DataTransfer["dropEffect"],
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [] as readonly string[],
    clearData: (format?: string) => {
      if (format) store.delete(format);
      else store.clear();
    },
    getData: (format: string) => store.get(format) ?? "",
    setData: (format: string, data: string) => {
      store.set(format, data);
    },
    setDragImage: vi.fn(),
  };
}

describe("ProjectLeftPanel", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    useMemoryPersistStorage();
    useWorkspaceStore.setState({ workspacePath: null });
    useProjectStore.getState().resetProjectState();
    useChatStore.getState().resetChat();
  });

  it("shows empty CTA when no projects", () => {
    const onOpenProject = vi.fn();
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    expect(screen.getByRole("button", { name: /open project/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add project/i })).not.toBeInTheDocument();
  });

  it("calls onRequestOpenProject when empty CTA is clicked", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    await user.click(screen.getByRole("button", { name: /open project/i }));
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("shows add project button on Projects section when projects exist", () => {
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    expect(screen.getByRole("button", { name: /add project/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open project/i })).not.toBeInTheDocument();
  });

  it("calls onRequestOpenProject when add project button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    await user.click(screen.getByRole("button", { name: /add project/i }));
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("opens folder via add project button when projects exist", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel folderPicker={createMemoryFolderPicker("/work/second-app")} />);
    await user.click(screen.getByRole("button", { name: /add project/i }));
    await waitFor(() => {
      expect(useProjectStore.getState().projects).toHaveLength(2);
    });
    expect(useProjectStore.getState().projects[1]?.folderPath).toBe("/work/second-app");
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/second-app");
  });

  it("opens folder via folder picker when empty CTA has no onRequestOpenProject", async () => {
    const user = userEvent.setup();
    render(<ProjectLeftPanel folderPicker={createMemoryFolderPicker("/work/new-app")} />);
    await user.click(screen.getByRole("button", { name: /open project/i }));
    await waitFor(() => {
      expect(useProjectStore.getState().projects).toHaveLength(1);
    });
    expect(useProjectStore.getState().projects[0]?.folderPath).toBe("/work/new-app");
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/new-app");
  });

  it("selects a chunk on click", async () => {
    const user = userEvent.setup();
    const { chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(null, null);
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: "Main" }));
    expect(useProjectStore.getState().activeChunkId).toBe(chunk.id);
  });

  it("collapses and expands project chunk tree", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    expect(screen.getByRole("button", { name: "Main" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "app" }));
    expect(screen.queryByRole("button", { name: "Main" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "app" }));
    expect(screen.getByRole("button", { name: "Main" })).toBeInTheDocument();
  });

  it("pins a project via the pin button", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: "Pin project app" }));
    expect(useProjectStore.getState().projects.find((p) => p.id === project.id)?.pinned).toBe(
      true,
    );
    await user.click(screen.getByRole("button", { name: "Unpin project app" }));
    expect(useProjectStore.getState().projects.find((p) => p.id === project.id)?.pinned).toBe(
      false,
    );
  });

  it("adds a child chunk and activates it", async () => {
    const user = userEvent.setup();
    const { chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(null, null);
    render(<ProjectLeftPanel />);
    const beforeCount = useProjectStore.getState().chunks.length;
    await user.click(screen.getByRole("button", { name: "Add child chunk" }));
    const after = useProjectStore.getState();
    expect(after.chunks.length).toBe(beforeCount + 1);
    const child = after.chunks.find((c) => c.parentChunkId === chunk.id);
    expect(child).toBeDefined();
    expect(after.activeChunkId).toBe(child?.id);
    expect(screen.getByRole("button", { name: "New chunk" })).toBeInTheDocument();
  });

  it("deletes a chunk when confirm is accepted", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: "Delete chunk Main" }));
    expect(confirmSpy).toHaveBeenCalledWith("Delete this chunk and its children?");
    expect(useProjectStore.getState().chunks.find((c) => c.id === root.id)).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Main" })).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("adds a root chunk on the project row", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(null, null);
    render(<ProjectLeftPanel />);
    const beforeCount = useProjectStore
      .getState()
      .chunks.filter((c) => c.projectId === project.id && c.parentChunkId === null).length;
    await user.click(screen.getByRole("button", { name: "Add root chunk" }));
    const roots = useProjectStore
      .getState()
      .chunks.filter((c) => c.projectId === project.id && c.parentChunkId === null);
    expect(roots.length).toBe(beforeCount + 1);
    expect(useProjectStore.getState().activeChunkId).toBe(roots[roots.length - 1]?.id);
  });

  it("filters by chunk title and chat message body", async () => {
    const user = userEvent.setup();
    const { chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/Alpha",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const other = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Other",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Notes",
      nowIso: "2026-07-10T00:00:01.500Z",
    });
    useChatStore.getState().appendMessage({
      chunkId: other.id,
      role: "user",
      content: "unique-zebra-token",
      createdAt: "2026-07-10T00:00:02.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.type(screen.getByRole("searchbox", { name: /search projects/i }), "zebra");
    expect(screen.getByRole("button", { name: /^Other$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Main$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Notes$/i })).not.toBeInTheDocument();
  });

  it("filters by chunk title", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/Alpha",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.type(screen.getByRole("searchbox", { name: /search projects/i }), "main");
    expect(screen.getByRole("button", { name: /^Main$/i })).toBeInTheDocument();
  });

  it("renders auto groups and moves project to manual group", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/apps/alpha",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/apps/beta",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Favorites");
    render(<ProjectLeftPanel />);
    expect(screen.getByText("apps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "beta" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /move alpha to group/i }));
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "beta" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move alpha to group/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove alpha from group/i }),
    ).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it("reorders sibling chunks via HTML5 drag and drop", () => {
    const { chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const a = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "ChunkA",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    const b = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "ChunkB",
      nowIso: "2026-07-10T00:00:02.000Z",
    })!;
    render(<ProjectLeftPanel />);
    const buttonA = screen.getByRole("button", { name: /^ChunkA$/i });
    const buttonB = screen.getByRole("button", { name: /^ChunkB$/i });
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(buttonB, { dataTransfer });
    fireEvent.dragOver(buttonA, { dataTransfer });
    fireEvent.drop(buttonA, { dataTransfer });
    const ordered = useProjectStore
      .getState()
      .chunks.filter((c) => c.parentChunkId === root.id)
      .sort((x, y) => x.siblingOrder - y.siblingOrder)
      .map((c) => c.id);
    expect(ordered).toEqual([b.id, a.id]);
  });

  it("relinks folder and updates workspace when project is active", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useWorkspaceStore.getState().setWorkspace("/work/app");
    render(
      <ProjectLeftPanel folderPicker={createMemoryFolderPicker("/work/relocated")} />,
    );
    await user.click(screen.getByRole("button", { name: "Relink folder" }));
    await waitFor(() => {
      expect(
        useProjectStore.getState().projects.find((p) => p.id === project.id)?.folderPath,
      ).toBe("/work/relocated");
    });
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/relocated");
  });
});
