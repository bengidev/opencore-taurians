import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "../../chat/state/chatStore";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { createMemoryFolderPicker } from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "../state/projectStore";
import { ProjectLeftPanel } from "./projectLeftPanel";

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

  it("deletes a trunk from the context menu when confirm is accepted", async () => {
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
    fireEvent.contextMenu(screen.getByRole("button", { name: "default" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(confirmSpy).toHaveBeenCalledWith("Delete this trunk?");
    expect(useProjectStore.getState().trunks.find((c) => c.title === "default")).toBeUndefined();
    expect(screen.getByRole("button", { name: "Sibling" })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("renames a trunk from the context menu", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    fireEvent.contextMenu(screen.getByRole("button", { name: "default" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename trunk" });
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");
    expect(screen.getByRole("button", { name: "Renamed" })).toBeInTheDocument();
  });

  it("pins a trunk from the context menu", async () => {
    const user = userEvent.setup();
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    fireEvent.contextMenu(screen.getByRole("button", { name: "default" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pin" }));
    expect(useProjectStore.getState().trunks.find((t) => t.id === trunk.id)?.pinned).toBe(true);
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

  it("exposes draggable trunk rows and reorders siblings in the store", () => {
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
    expect(screen.getByRole("button", { name: /^ChunkA$/i })).toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.getByRole("button", { name: /^ChunkB$/i })).toHaveAttribute(
      "draggable",
      "true",
    );
    useProjectStore.getState().reorderSiblingTrunks(null, [root.id, b.id, a.id]);
    const ordered = useProjectStore
      .getState()
      .trunks.filter((c) => c.projectId === project.id && c.parentTrunkId === null)
      .sort((x, y) => x.siblingOrder - y.siblingOrder)
      .map((c) => c.id);
    expect(ordered).toEqual([root.id, b.id, a.id]);
  });

  it("indents trunks under the project like explorer depth-1", async () => {
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);

    const trunkButton = await screen.findByRole("button", { name: trunk.title });
    const list = trunkButton.closest("ul");
    expect(list).not.toBeNull();
    expect(list).toHaveStyle({ paddingLeft: "20px" });
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
