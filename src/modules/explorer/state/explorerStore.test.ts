import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useProjectStore } from "../../project/state/projectStore";
import { createMemoryExplorerApi } from "../api/createMemoryExplorerApi";
import { useExplorerStore } from "./explorerStore";

describe("explorerStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useExplorerStore.getState().resetExplorerState();
  });

  it("loadRoot loads children for active project", async () => {
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
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    expect(useExplorerStore.getState().childrenByPath["/proj"]).toHaveLength(1);
  });

  it("loadRoot keeps expanded folders when reloading the same project", async () => {
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
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    await useExplorerStore.getState().toggleExpanded(subDir);
    useExplorerStore.getState().selectPath("/proj/src/a.ts");

    await useExplorerStore.getState().loadRoot();

    const state = useExplorerStore.getState();
    expect(state.expandedPaths.has(subDir)).toBe(true);
    expect(state.selectedPath).toBe("/proj/src/a.ts");
    expect(state.childrenByPath[subDir]).toEqual([
      { name: "a.ts", path: "/proj/src/a.ts", isDir: false },
    ]);
  });

  it("loadRoot resets when the active project changes", async () => {
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/proj-a",
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      dirs: {
        "/proj-a": [{ name: "src", path: "/proj-a/src", isDir: true }],
        "/proj-a/src": [],
        "/proj-b": [{ name: "lib", path: "/proj-b/lib", isDir: true }],
        "/proj-b/lib": [],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    await useExplorerStore.getState().toggleExpanded("/proj-a/src");
    useExplorerStore.getState().selectPath("/proj-a/src");

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/proj-b",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    await useExplorerStore.getState().loadRoot();

    const state = useExplorerStore.getState();
    expect(state.projectRoot).toBe("/proj-b");
    expect(state.expandedPaths.size).toBe(0);
    expect(state.selectedPath).toBeNull();
    expect(state.childrenByPath["/proj-b"]).toHaveLength(1);
  });

  it("commitRename remaps expanded folder cache when renaming a directory", async () => {
    const folderPath = "/proj";
    const oldDir = "/proj/foo";
    const childFile = { name: "a.ts", path: "/proj/foo/a.ts", isDir: false };

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "foo", path: oldDir, isDir: true }],
        [oldDir]: [childFile],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    await useExplorerStore.getState().toggleExpanded(oldDir);
    useExplorerStore.getState().selectPath(childFile.path);
    useExplorerStore.setState({ renamingPath: oldDir });
    await useExplorerStore.getState().commitRename("bar");

    const state = useExplorerStore.getState();
    const newDir = "/proj/bar";
    const newChild = "/proj/bar/a.ts";

    expect(state.childrenByPath[newDir]).toEqual([
      { name: "a.ts", path: newChild, isDir: false },
    ]);
    expect(state.childrenByPath[oldDir]).toBeUndefined();
    expect(state.expandedPaths.has(newDir)).toBe(true);
    expect(state.expandedPaths.has(oldDir)).toBe(false);
    expect(state.selectedPath).toBe(newChild);
  });

  it("setSearchQuery updates searchQuery", () => {
    useExplorerStore.getState().setSearchQuery("dart");
    expect(useExplorerStore.getState().searchQuery).toBe("dart");
  });

  it("keeps searchQuery on same-project loadRoot remount", async () => {
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
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    useExplorerStore.getState().setSearchQuery("a.ts");

    await useExplorerStore.getState().loadRoot();

    expect(useExplorerStore.getState().searchQuery).toBe("a.ts");
  });

  it("clears searchQuery when loadRoot switches projects", async () => {
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/proj-a",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const api = createMemoryExplorerApi({
      dirs: {
        "/proj-a": [{ name: "a.ts", path: "/proj-a/a.ts", isDir: false }],
        "/proj-b": [{ name: "b.ts", path: "/proj-b/b.ts", isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    useExplorerStore.getState().setSearchQuery("a.ts");

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/proj-b",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    await useExplorerStore.getState().loadRoot();

    expect(useExplorerStore.getState().searchQuery).toBe("");
    expect(useExplorerStore.getState().projectRoot).toBe("/proj-b");
  });

  it("setSearchQuery loads nested folders for search without expanding them", async () => {
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
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    expect(useExplorerStore.getState().childrenByPath[subDir]).toBeUndefined();

    useExplorerStore.getState().setSearchQuery("main");
    await vi.waitFor(() => {
      expect(useExplorerStore.getState().childrenByPath[subDir]).toEqual([
        { name: "main.dart", path: "/proj/src/main.dart", isDir: false },
      ]);
    });
    expect(useExplorerStore.getState().expandedPaths.size).toBe(0);
  });

  it("search indexing skips descending into build and .dart_tool", async () => {
    const folderPath = "/proj";
    const listDir = vi.fn(async (_root: string, dirPath: string) => {
      const dirs: Record<string, { name: string; path: string; isDir: boolean }[]> = {
        [folderPath]: [
          { name: "build", path: "/proj/build", isDir: true },
          { name: ".dart_tool", path: "/proj/.dart_tool", isDir: true },
          { name: "lib", path: "/proj/lib", isDir: true },
        ],
        "/proj/lib": [
          { name: "main.dart", path: "/proj/lib/main.dart", isDir: false },
        ],
        "/proj/build": [
          { name: "secret.dart", path: "/proj/build/secret.dart", isDir: false },
        ],
        "/proj/.dart_tool": [
          { name: "main.dart", path: "/proj/.dart_tool/main.dart", isDir: false },
        ],
      };
      return dirs[dirPath] ?? [];
    });

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const api = {
      ...createMemoryExplorerApi({ projectRoot: folderPath }),
      listDir,
    };
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    listDir.mockClear();

    useExplorerStore.getState().setSearchQuery("main");
    await vi.waitFor(() => {
      expect(useExplorerStore.getState().childrenByPath["/proj/lib"]).toBeDefined();
      expect(useExplorerStore.getState().searchIndexing).toBe(false);
    });

    expect(listDir.mock.calls.map((call) => call[1])).not.toContain("/proj/build");
    expect(listDir.mock.calls.map((call) => call[1])).not.toContain(
      "/proj/.dart_tool",
    );
    expect(useExplorerStore.getState().childrenByPath["/proj/build"]).toBeUndefined();
  });
});
