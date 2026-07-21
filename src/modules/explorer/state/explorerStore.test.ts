import { beforeEach, describe, expect, it } from "vitest";
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
});
