import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useProjectStore } from "../../project/state/projectStore";
import { createMemoryExplorerApi } from "../api/createMemoryExplorerApi";
import type { ExplorerApi } from "../api/explorerApi";
import type { ExplorerDropPayload } from "../domain/explorerTypes";
import { useExplorerStore } from "../state/explorerStore";
import { ExplorerPanel } from "./ExplorerPanel";

describe("ExplorerPanel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useExplorerStore.getState().resetExplorerState();
  });

  it("context menu shows Rename, Delete, and Copy Path on file row", async () => {
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);

    const fileRow = await screen.findByText("a.ts");
    fireEvent.contextMenu(fileRow);

    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy Path" })).toBeInTheDocument();
  });

  it("context menu Delete removes the file", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);

    const fileRow = await screen.findByText("a.ts");
    fireEvent.contextMenu(fileRow);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("a.ts")).not.toBeInTheDocument();
    });
  });

  it("context menu Rename enters rename mode", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);

    const fileRow = await screen.findByText("a.ts");
    fireEvent.contextMenu(fileRow);
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(screen.getByRole("textbox", { name: "Rename" })).toHaveValue("a.ts");
    expect(useExplorerStore.getState().renamingPath).toBe("/proj/a.ts");
  });

  it("cancels rename when Escape is pressed", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);

    const fileRow = await screen.findByText("a.ts");
    fireEvent.contextMenu(fileRow);
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    const input = screen.getByRole("textbox", { name: "Rename" });
    await user.type(input, "{Escape}");

    expect(screen.queryByRole("textbox", { name: "Rename" })).not.toBeInTheDocument();
    expect(useExplorerStore.getState().renamingPath).toBeNull();
  });

  it("cancels rename when another file is clicked", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [
          { name: "a.ts", path: "/proj/a.ts", isDir: false },
          { name: "b.ts", path: "/proj/b.ts", isDir: false },
        ],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);

    fireEvent.contextMenu(await screen.findByText("a.ts"));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("textbox", { name: "Rename" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "b.ts" }));

    expect(screen.queryByRole("textbox", { name: "Rename" })).not.toBeInTheDocument();
    expect(useExplorerStore.getState().renamingPath).toBeNull();
    expect(useExplorerStore.getState().selectedPath).toBe("/proj/b.ts");
  });

  it("cancels rename when clicking empty explorer area", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    const { container } = render(<ExplorerPanel explorerApi={api} />);

    fireEvent.contextMenu(await screen.findByText("a.ts"));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(screen.getByRole("textbox", { name: "Rename" })).toBeInTheDocument();

    const scrollArea = container.querySelector(".overflow-y-auto");
    expect(scrollArea).not.toBeNull();
    fireEvent.mouseDown(scrollArea!);

    expect(screen.queryByRole("textbox", { name: "Rename" })).not.toBeInTheDocument();
    expect(useExplorerStore.getState().renamingPath).toBeNull();
  });

  it("keeps the tree area scrollable inside a height-constrained panel", () => {
    const { container } = render(<ExplorerPanel />);
    const panel = screen.getByLabelText("explorer panel");
    expect(panel.className).toMatch(/min-h-0/);
    expect(panel.className).toMatch(/flex-col/);

    const trigger = container.querySelector('[data-slot="context-menu-trigger"]');
    expect(trigger).not.toBeNull();
    expect(trigger!.className).toMatch(/flex-1/);
    expect(trigger!.className).toMatch(/flex-col/);
    expect(trigger!.className).toMatch(/min-h-0/);
    expect(trigger!.className).toMatch(/overflow-hidden/);

    const scrollArea = container.querySelector(".overflow-y-auto");
    expect(scrollArea).not.toBeNull();
    expect(scrollArea!.className).toMatch(/min-h-0/);
    expect(scrollArea!.className).toMatch(/flex-1/);
  });

  it("context menu Copy Path writes to clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });

    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);

    const fileRow = await screen.findByText("a.ts");
    fireEvent.contextMenu(fileRow);
    await user.click(screen.getByRole("menuitem", { name: "Copy Path" }));

    expect(writeText).toHaveBeenCalledWith("/proj/a.ts");
    vi.unstubAllGlobals();
  });

  it("context menu New File creates a file in the target folder", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);

    const emptyState = await screen.findByText(/this folder is empty/i);
    fireEvent.contextMenu(emptyState);
    await user.click(screen.getByRole("menuitem", { name: "New File" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Rename" })).toBeInTheDocument();
    });
    expect(useExplorerStore.getState().childrenByPath[folderPath]).toHaveLength(1);
  });

  it("expands a folder when the row is clicked inside the context menu trigger", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    const subDir = "/proj/src";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "src", path: subDir, isDir: true }],
        [subDir]: [{ name: "a.ts", path: "/proj/src/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    await user.click(await screen.findByRole("button", { name: "src" }));

    expect(await screen.findByText("a.ts")).toBeInTheDocument();
    expect(useExplorerStore.getState().expandedPaths.has(subDir)).toBe(true);
  });

  it("filters the loaded tree by basename and keeps ancestors visible", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    const subDir = "/proj/src";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [
          { name: "src", path: subDir, isDir: true },
          { name: "README.md", path: "/proj/README.md", isDir: false },
        ],
        [subDir]: [
          { name: "main.dart", path: "/proj/src/main.dart", isDir: false },
        ],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    await user.click(await screen.findByRole("button", { name: "src" }));
    expect(await screen.findByText("main.dart")).toBeInTheDocument();

    const expandedBefore = new Set(useExplorerStore.getState().expandedPaths);
    await user.type(screen.getByRole("searchbox", { name: "Search files" }), "main");

    expect(screen.getByText("main.dart")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.queryByText("README.md")).not.toBeInTheDocument();

    const expandedAfter = useExplorerStore.getState().expandedPaths;
    expect([...expandedAfter].sort()).toEqual([...expandedBefore].sort());
  });

  it("finds nested files without expanding folders first and keeps typed case", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    const subDir = "/proj/src";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "src", path: subDir, isDir: true }],
        [subDir]: [
          { name: "main.dart", path: "/proj/src/main.dart", isDir: false },
        ],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    expect(await screen.findByText("src")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search files" });
    expect(search.className).not.toMatch(/\buppercase\b/);

    await user.type(search, "Main");
    expect(search).toHaveValue("Main");
    expect(await screen.findByText("main.dart")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(useExplorerStore.getState().expandedPaths.size).toBe(0);
  });

  it("clears the filter and restores the full loaded tree", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [
          { name: "a.ts", path: "/proj/a.ts", isDir: false },
          { name: "b.ts", path: "/proj/b.ts", isDir: false },
        ],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    expect(await screen.findByText("a.ts")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search files" });
    await user.type(search, "a.ts");
    expect(screen.queryByText("b.ts")).not.toBeInTheDocument();

    await user.clear(search);
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
  });

  it("shows no-matching hint when the filter matches nothing", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    expect(await screen.findByText("a.ts")).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: "Search files" }),
      "zzz",
    );
    expect(screen.getByText(/no matching files/i)).toBeInTheDocument();
  });

  it("skips copy when OS drop hits the editor drop zone", async () => {
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const copyPaths = vi.fn().mockResolvedValue([]);
    let dropHandler: ((payload: ExplorerDropPayload) => void) | undefined;

    const baseApi = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    const api: ExplorerApi = {
      ...baseApi,
      copyPaths,
      onDrop: async (callback) => {
        dropHandler = callback;
        return (() => {
          dropHandler = undefined;
        }) satisfies UnlistenFn;
      },
    };

    const editorZone = document.createElement("div");
    editorZone.setAttribute("data-editor-drop-zone", "");
    document.body.appendChild(editorZone);
    document.elementFromPoint = vi.fn().mockReturnValue(editorZone);

    render(<ExplorerPanel explorerApi={api} />);

    await waitFor(() => expect(dropHandler).toBeDefined());

    dropHandler!({
      paths: ["/external/file.ts"],
      x: 12,
      y: 34,
    });

    await waitFor(() => {
      expect(copyPaths).not.toHaveBeenCalled();
    });

    editorZone.remove();
  });
});
