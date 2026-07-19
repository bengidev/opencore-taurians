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
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText(/open a folder to add your first project/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open project/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: /search projects/i })).not.toBeInTheDocument();
  });

  it("calls onRequestOpenProject when empty CTA is clicked", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    await user.click(screen.getByRole("button", { name: /open project/i }));
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("shows add project button on Projects section when projects exist", () => {
    useProjectStore.getState().createProjectWithRootTrunk({
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
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    await user.click(screen.getByRole("button", { name: /add project/i }));
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("opens folder via add project button when projects exist", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootTrunk({
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

  it("selects a trunk on click", async () => {
    const user = userEvent.setup();
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(null, null);
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: "default" }));
    expect(useProjectStore.getState().activeTrunkId).toBe(trunk.id);
  });

  it("collapses and expands project trunk tree", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    expect(screen.getByRole("button", { name: "default" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "app" }));
    expect(screen.queryByRole("button", { name: "default" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "app" }));
    expect(screen.getByRole("button", { name: "default" })).toBeInTheDocument();
  });

  it("pins a project via the pin button", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
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

  it("adds a root trunk and activates it", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(null, null);
    render(<ProjectLeftPanel />);
    const beforeCount = useProjectStore.getState().trunks.length;
    await user.click(screen.getByRole("button", { name: "Add root trunk" }));
    const after = useProjectStore.getState();
    expect(after.trunks.length).toBe(beforeCount + 1);
    const added = after.trunks.find(
      (trunk) => trunk.projectId === project.id && trunk.title === "new trunk",
    );
    expect(added).toBeDefined();
    expect(added?.parentTrunkId).toBeNull();
    expect(after.activeTrunkId).toBe(added?.id);
    expect(screen.getByRole("button", { name: "new trunk" })).toBeInTheDocument();
  });

  it("does not show add child trunk controls", () => {
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    expect(screen.queryByRole("button", { name: "Add child trunk" })).not.toBeInTheDocument();
  });

  it("deletes a trunk when confirm is accepted", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().addRootTrunk({
      projectId: project.id,
      title: "Sibling",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: "Delete trunk default" }));
    expect(confirmSpy).toHaveBeenCalledWith("Delete this trunk?");
    expect(useProjectStore.getState().trunks.find((c) => c.title === "default")).toBeUndefined();
    expect(screen.getByRole("button", { name: "Sibling" })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("adds a root trunk on the project row", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(null, null);
    render(<ProjectLeftPanel />);
    const beforeCount = useProjectStore
      .getState()
      .trunks.filter((c) => c.projectId === project.id && c.parentTrunkId === null).length;
    await user.click(screen.getByRole("button", { name: "Add root trunk" }));
    const roots = useProjectStore
      .getState()
      .trunks.filter((c) => c.projectId === project.id && c.parentTrunkId === null);
    expect(roots.length).toBe(beforeCount + 1);
    expect(useProjectStore.getState().activeTrunkId).toBe(roots[roots.length - 1]?.id);
  });

  it("filters by trunk title and chat message body", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/Alpha",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const other = useProjectStore.getState().addRootTrunk({
      projectId: project.id,
      title: "Other",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    useProjectStore.getState().addRootTrunk({
      projectId: project.id,
      title: "Notes",
      nowIso: "2026-07-10T00:00:01.500Z",
    });
    useChatStore.getState().appendMessage({
      trunkId: other.id,
      role: "user",
      content: "unique-zebra-token",
      createdAt: "2026-07-10T00:00:02.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.type(screen.getByRole("searchbox", { name: /search projects/i }), "zebra");
    expect(screen.getByRole("button", { name: /^Other$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "default" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Notes$/i })).not.toBeInTheDocument();
  });

  it("filters by trunk title", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/Alpha",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.type(screen.getByRole("searchbox", { name: /search projects/i }), "default");
    expect(screen.getByRole("button", { name: "default" })).toBeInTheDocument();
  });

  it("renders auto groups and moves project to manual group", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/apps/alpha",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().createProjectWithRootTrunk({
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

  it("reorders sibling trunks via HTML5 drag and drop", () => {
    const { project, trunk: root } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const a = useProjectStore.getState().addRootTrunk({
      projectId: project.id,
      title: "ChunkA",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    const b = useProjectStore.getState().addRootTrunk({
      projectId: project.id,
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
      .trunks.filter((c) => c.projectId === project.id && c.parentTrunkId === null)
      .sort((x, y) => x.siblingOrder - y.siblingOrder)
      .map((c) => c.id);
    expect(ordered).toEqual([root.id, b.id, a.id]);
  });

  it("relinks folder and updates workspace when project is active", async () => {
    const user = userEvent.setup();
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
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
