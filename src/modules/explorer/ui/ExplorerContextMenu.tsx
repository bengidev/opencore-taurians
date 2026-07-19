import { useState, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { projectNormalizeFolderPath } from "../../project/domain/projectPath";
import type { ExplorerEntry } from "../domain/explorerTypes";
import { useExplorerStore } from "../state/explorerStore";

export interface ExplorerContextMenuProps {
  targetPath: string | null;
  children: ReactNode;
}

type ContextTargetKind = "folder" | "file" | "empty";

interface ContextTarget {
  path: string;
  kind: ContextTargetKind;
}

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? path : path.slice(0, index);
}

function findEntry(path: string): ExplorerEntry | null {
  const { childrenByPath } = useExplorerStore.getState();
  for (const children of Object.values(childrenByPath)) {
    const entry = children.find((item) => item.path === path);
    if (entry) {
      return entry;
    }
  }
  return null;
}

function resolveContextTarget(
  event: React.MouseEvent,
  fallbackPath: string | null,
): ContextTarget | null {
  const hit = (event.target as HTMLElement).closest("[data-explorer-path]");
  if (hit) {
    const path = projectNormalizeFolderPath(hit.getAttribute("data-explorer-path")!);
    const entry = findEntry(path);
    if (entry) {
      return { path, kind: entry.isDir ? "folder" : "file" };
    }
    if (useExplorerStore.getState().childrenByPath[path]) {
      return { path, kind: "folder" };
    }
    return { path, kind: "file" };
  }

  if (!fallbackPath) {
    return null;
  }

  return {
    path: projectNormalizeFolderPath(fallbackPath),
    kind: "empty",
  };
}

export function ExplorerContextMenu({
  targetPath,
  children,
}: ExplorerContextMenuProps) {
  const [contextTarget, setContextTarget] = useState<ContextTarget | null>(null);

  const handleNewFile = async (parentDirPath: string) => {
    const { api, projectRoot, startRename, loadDir } = useExplorerStore.getState();
    if (!api || !projectRoot) {
      return;
    }
    const entry = await api.createFile(projectRoot, parentDirPath);
    await loadDir(parentDirPath);
    startRename(entry.path);
  };

  const handleNewFolder = async (parentDirPath: string) => {
    const { api, projectRoot, startRename, loadDir } = useExplorerStore.getState();
    if (!api || !projectRoot) {
      return;
    }
    const entry = await api.createDir(projectRoot, parentDirPath);
    await loadDir(parentDirPath);
    startRename(entry.path);
  };

  const handleDelete = async (path: string) => {
    const { api, projectRoot, refresh } = useExplorerStore.getState();
    if (!api || !projectRoot) {
      return;
    }
    await api.trash(projectRoot, path);
    await refresh();
  };

  const handleDuplicate = async (path: string) => {
    const { api, projectRoot, refresh } = useExplorerStore.getState();
    if (!api || !projectRoot) {
      return;
    }
    await api.duplicate(projectRoot, path);
    await refresh();
  };

  const handleReveal = async (path: string) => {
    const { api } = useExplorerStore.getState();
    if (!api) {
      return;
    }
    await api.reveal(path);
  };

  const handleCopyPath = async (path: string) => {
    await navigator.clipboard.writeText(path);
  };

  const parentForTarget = (target: ContextTarget): string => {
    if (target.kind === "folder" || target.kind === "empty") {
      return target.path;
    }
    return parentDir(target.path);
  };

  const kind = contextTarget?.kind;

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (!open) {
          setContextTarget(null);
        }
      }}
    >
      <ContextMenuTrigger
        className="min-h-0 flex-1"
        onContextMenu={(event) => {
          setContextTarget(resolveContextTarget(event, targetPath));
        }}
      >
        {children}
      </ContextMenuTrigger>
      {contextTarget ? (
        <ContextMenuContent>
          {kind === "folder" || kind === "empty" ? (
            <>
              <ContextMenuItem
                onSelect={() => void handleNewFile(parentForTarget(contextTarget))}
              >
                New File
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => void handleNewFolder(parentForTarget(contextTarget))}
              >
                New Folder
              </ContextMenuItem>
            </>
          ) : null}
          {kind === "folder" || kind === "file" ? (
            <>
              {kind === "folder" ? <ContextMenuSeparator /> : null}
              <ContextMenuItem
                onSelect={() => useExplorerStore.getState().startRename(contextTarget.path)}
              >
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => void handleDuplicate(contextTarget.path)}
              >
                Duplicate
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                onSelect={() => void handleDelete(contextTarget.path)}
              >
                Delete
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => void handleReveal(contextTarget.path)}>
                Reveal in Finder
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void handleCopyPath(contextTarget.path)}>
                Copy Path
              </ContextMenuItem>
            </>
          ) : null}
          {kind === "folder" || kind === "empty" ? (
            <>
              {kind === "folder" ? <ContextMenuSeparator /> : null}
              <ContextMenuItem
                onSelect={() => void useExplorerStore.getState().refresh()}
              >
                Refresh
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}
