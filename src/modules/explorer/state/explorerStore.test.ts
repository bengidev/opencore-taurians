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
