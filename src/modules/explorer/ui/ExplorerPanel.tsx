import { useEffect } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { projectNormalizeFolderPath } from "../../project/domain/projectPath";
import { useProjectStore } from "../../project/state/projectStore";
import { useShellStore } from "../../shell/state/shellStore";
import {
  createTauriExplorerApi,
  type ExplorerApi,
} from "../api/explorerApi";
import type { ExplorerDropPayload } from "../domain/explorerTypes";
import { useExplorerStore } from "../state/explorerStore";
import { ExplorerContextMenu } from "./ExplorerContextMenu";
import { ExplorerEmptySelectProject } from "./ExplorerEmptySelectProject";
import { ExplorerTree } from "./ExplorerTree";

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? path : path.slice(0, index);
}

function resolveDropTargetDir(
  payload: ExplorerDropPayload,
  projectRoot: string,
): string {
  const element = document.elementFromPoint(payload.x, payload.y);
  const hit = element?.closest("[data-explorer-path]");
  const hitPath = hit?.getAttribute("data-explorer-path");
  if (!hitPath) {
    return projectRoot;
  }

  const path = projectNormalizeFolderPath(hitPath);
  const { childrenByPath } = useExplorerStore.getState();
  for (const children of Object.values(childrenByPath)) {
    const entry = children.find((item) => item.path === path);
    if (entry) {
      return entry.isDir ? path : parentDir(path);
    }
  }

  if (childrenByPath[path]) {
    return path;
  }

  return parentDir(path);
}

async function handleExternalDrop(payload: ExplorerDropPayload): Promise<void> {
  const { api, projectRoot, refresh } = useExplorerStore.getState();
  if (!api || !projectRoot || payload.paths.length === 0) {
    return;
  }

  const targetDir = resolveDropTargetDir(payload, projectRoot);
  await api.copyPaths(projectRoot, targetDir, payload.paths);
  await refresh();
}

export interface ExplorerPanelProps {
  explorerApi?: ExplorerApi;
}

export function ExplorerPanel({
  explorerApi = createTauriExplorerApi(),
}: ExplorerPanelProps) {
  const project = useProjectStore((s) =>
    s.projects.find((item) => item.id === s.activeProjectId),
  );

  useEffect(() => {
    const api = explorerApi;
    const { bindApi, loadRoot } = useExplorerStore.getState();
    bindApi(api);
    void loadRoot();

    let unlistenChanged: UnlistenFn | undefined;
    let unlistenDrop: UnlistenFn | undefined;
    let watchedRoot: string | null = null;

    const applyWatch = async (projectRoot: string | null): Promise<void> => {
      if (watchedRoot && watchedRoot !== projectRoot) {
        await api.unwatch(watchedRoot);
        watchedRoot = null;
      }

      if (!projectRoot) {
        return;
      }

      const mode = useShellStore.getState().explorerAutoRefresh;
      await api.unwatch(projectRoot);
      await api.watch(projectRoot, mode);
      watchedRoot = projectRoot;
    };

    void api
      .onChanged((root) => {
        const { projectRoot, refresh } = useExplorerStore.getState();
        if (projectRoot && root === projectRoot) {
          void refresh();
        }
      })
      .then((unlisten) => {
        unlistenChanged = unlisten;
      });

    void api
      .onDrop((payload) => {
        void handleExternalDrop(payload);
      })
      .then((unlisten) => {
        unlistenDrop = unlisten;
      });

    void applyWatch(useExplorerStore.getState().projectRoot);

    const unsubscribeShell = useShellStore.subscribe((state, prev) => {
      if (state.explorerAutoRefresh !== prev.explorerAutoRefresh) {
        void applyWatch(useExplorerStore.getState().projectRoot);
      }
    });

    const unsubscribeExplorer = useExplorerStore.subscribe((state, prev) => {
      if (state.projectRoot !== prev.projectRoot) {
        void applyWatch(state.projectRoot);
      }
    });

    return () => {
      unlistenChanged?.();
      unlistenDrop?.();
      unsubscribeShell();
      unsubscribeExplorer();
      if (watchedRoot) {
        void api.unwatch(watchedRoot);
      }
    };
  }, [explorerApi]);

  return (
    <aside aria-label="explorer panel" className="flex h-full min-h-0 flex-col">
      <p className="truncate border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {project?.name ?? "Explorer"}
      </p>
      <ExplorerContextMenu targetPath={project?.folderPath ?? null}>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {project ? <ExplorerTree /> : <ExplorerEmptySelectProject />}
        </div>
      </ExplorerContextMenu>
    </aside>
  );
}
