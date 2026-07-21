import { create } from "zustand";
import type { ExplorerApi } from "../api/explorerApi";
import type { ExplorerEntry } from "../domain/explorerTypes";
import { projectNormalizeFolderPath } from "../../project/domain/projectPath";
import { useProjectStore } from "../../project/state/projectStore";

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? path : path.slice(0, index);
}

function remapPathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  if (path === oldPrefix) {
    return newPrefix;
  }
  if (path.startsWith(`${oldPrefix}/`)) {
    return `${newPrefix}${path.slice(oldPrefix.length)}`;
  }
  return path;
}

function remapChildrenByPath(
  childrenByPath: Record<string, ExplorerEntry[]>,
  oldPrefix: string,
  newPrefix: string,
): Record<string, ExplorerEntry[]> {
  const next: Record<string, ExplorerEntry[]> = {};

  for (const [dirPath, children] of Object.entries(childrenByPath)) {
    const remappedDir = remapPathPrefix(dirPath, oldPrefix, newPrefix);
    next[remappedDir] = children.map((item) => {
      const remappedPath = remapPathPrefix(item.path, oldPrefix, newPrefix);
      return remappedPath === item.path ? item : { ...item, path: remappedPath };
    });
  }

  return next;
}

function remapExpandedPaths(
  expandedPaths: Set<string>,
  oldPrefix: string,
  newPrefix: string,
): Set<string> {
  const next = new Set<string>();

  for (const path of expandedPaths) {
    next.add(remapPathPrefix(path, oldPrefix, newPrefix));
  }

  return next;
}

function createEmptyState() {
  return {
    api: null as ExplorerApi | null,
    projectRoot: null as string | null,
    childrenByPath: {} as Record<string, ExplorerEntry[]>,
    expandedPaths: new Set<string>(),
    selectedPath: null as string | null,
    renamingPath: null as string | null,
    error: null as string | null,
    loadingPaths: new Set<string>(),
  };
}

export interface ExplorerState {
  api: ExplorerApi | null;
  projectRoot: string | null;
  childrenByPath: Record<string, ExplorerEntry[]>;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  renamingPath: string | null;
  error: string | null;
  loadingPaths: Set<string>;
  resetExplorerState: () => void;
  bindApi: (api: ExplorerApi) => void;
  loadRoot: () => Promise<void>;
  loadDir: (dirPath: string) => Promise<void>;
  toggleExpanded: (path: string) => Promise<void>;
  selectPath: (path: string | null) => void;
  startRename: (path: string) => void;
  commitRename: (newName: string) => Promise<void>;
  cancelRename: () => void;
  clearError: () => void;
  refresh: () => Promise<void>;
}

let projectSubscription: (() => void) | undefined;

function unsubscribeFromActiveProject(): void {
  projectSubscription?.();
  projectSubscription = undefined;
}

function subscribeToActiveProject(loadRoot: () => Promise<void>): void {
  unsubscribeFromActiveProject();
  projectSubscription = useProjectStore.subscribe((state, prev) => {
    if (state.activeProjectId === prev.activeProjectId) {
      return;
    }
    void loadRoot();
  });
}

export const useExplorerStore = create<ExplorerState>()((set, get) => {
  const loadDir = async (dirPath: string): Promise<void> => {
    const { api, projectRoot } = get();
    if (!api || !projectRoot) {
      return;
    }

    const loadingPaths = new Set(get().loadingPaths);
    loadingPaths.add(dirPath);
    set({ loadingPaths, error: null });

    try {
      const children = await api.listDir(projectRoot, dirPath);
      const nextLoading = new Set(get().loadingPaths);
      nextLoading.delete(dirPath);
      set((state) => ({
        childrenByPath: { ...state.childrenByPath, [dirPath]: children },
        loadingPaths: nextLoading,
        error: null,
      }));
    } catch (error) {
      const nextLoading = new Set(get().loadingPaths);
      nextLoading.delete(dirPath);
      set({
        loadingPaths: nextLoading,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const loadRoot = async (): Promise<void> => {
    const { api } = get();
    const { activeProjectId, projects } = useProjectStore.getState();
    const project = projects.find((item) => item.id === activeProjectId);

    if (!api || !project) {
      set({
        ...createEmptyState(),
        api,
      });
      return;
    }

    const projectRoot = projectNormalizeFolderPath(project.folderPath);

    // Remounting the explorer (e.g. hide/show right panel) calls loadRoot again.
    // Keep expansion/selection when the active project root is unchanged.
    if (
      get().projectRoot === projectRoot &&
      get().childrenByPath[projectRoot]
    ) {
      return;
    }

    set({
      projectRoot,
      childrenByPath: {},
      expandedPaths: new Set<string>(),
      selectedPath: null,
      renamingPath: null,
      error: null,
      loadingPaths: new Set<string>(),
    });

    await loadDir(projectRoot);
  };

  return {
    ...createEmptyState(),
    resetExplorerState: () => {
      unsubscribeFromActiveProject();
      set(createEmptyState());
    },
    bindApi: (api) => {
      set({ api });
      subscribeToActiveProject(loadRoot);
    },
    loadRoot,
    loadDir,
    toggleExpanded: async (path) => {
      const { expandedPaths, childrenByPath } = get();
      const nextExpanded = new Set(expandedPaths);

      if (nextExpanded.has(path)) {
        nextExpanded.delete(path);
        set({ expandedPaths: nextExpanded });
        return;
      }

      nextExpanded.add(path);
      set({ expandedPaths: nextExpanded });

      if (!childrenByPath[path]) {
        await loadDir(path);
      }
    },
    selectPath: (path) => {
      const { renamingPath } = get();
      if (renamingPath && path !== renamingPath) {
        set({ selectedPath: path, renamingPath: null });
        return;
      }
      set({ selectedPath: path });
    },
    startRename: (path) => set({ renamingPath: path, selectedPath: path }),
    commitRename: async (newName) => {
      const { api, projectRoot, renamingPath } = get();
      if (!api || !projectRoot || !renamingPath) {
        return;
      }

      const parentPath = parentDir(renamingPath);
      set({ error: null });

      try {
        const entry = await api.rename(projectRoot, renamingPath, newName);
        set((state) => {
          const siblings = state.childrenByPath[parentPath];
          let childrenByPath = siblings
            ? {
                ...state.childrenByPath,
                [parentPath]: siblings.map((item) =>
                  item.path === renamingPath ? entry : item,
                ),
              }
            : state.childrenByPath;

          let expandedPaths = state.expandedPaths;
          let selectedPath = state.selectedPath;

          if (entry.isDir && renamingPath !== entry.path) {
            childrenByPath = remapChildrenByPath(childrenByPath, renamingPath, entry.path);
            expandedPaths = remapExpandedPaths(expandedPaths, renamingPath, entry.path);
            if (selectedPath) {
              selectedPath = remapPathPrefix(selectedPath, renamingPath, entry.path);
            }
          } else if (selectedPath === renamingPath) {
            selectedPath = entry.path;
          }

          return {
            childrenByPath,
            expandedPaths,
            selectedPath,
            renamingPath: null,
            error: null,
          };
        });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    cancelRename: () => set({ renamingPath: null }),
    clearError: () => set({ error: null }),
    refresh: async () => {
      const { projectRoot, expandedPaths } = get();
      if (!projectRoot) {
        return;
      }

      const expanded = [...expandedPaths];
      set({
        childrenByPath: {},
        error: null,
      });

      await loadDir(projectRoot);

      for (const path of expanded) {
        if (path === projectRoot) {
          continue;
        }
        await loadDir(path);
      }
    },
  };
});
