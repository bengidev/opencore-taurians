import { useState, type ReactNode } from "react";
import {
  ClipboardCopy,
  Copy,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
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
import { explorerContextMenuClassName } from "./explorerStyles";

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

function setExplorerError(error: unknown): void {
  useExplorerStore.setState({
    error: error instanceof Error ? error.message : String(error),
  });
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
    try {
      const entry = await api.createFile(projectRoot, parentDirPath);
      await loadDir(parentDirPath);
      startRename(entry.path);
    } catch (error) {
      setExplorerError(error);
    }
  };

  const handleNewFolder = async (parentDirPath: string) => {
    const { api, projectRoot, startRename, loadDir } = useExplorerStore.getState();
    if (!api || !projectRoot) {
      return;
    }
    try {
      const entry = await api.createDir(projectRoot, parentDirPath);
      await loadDir(parentDirPath);
      startRename(entry.path);
    } catch (error) {
      setExplorerError(error);
    }
  };

  const handleDelete = async (path: string) => {
    const { api, projectRoot, refresh } = useExplorerStore.getState();
    if (!api || !projectRoot) {
      return;
    }
    try {
      await api.trash(projectRoot, path);
      await refresh();
    } catch (error) {
      setExplorerError(error);
    }
  };

  const handleDuplicate = async (path: string) => {
    const { api, projectRoot, refresh } = useExplorerStore.getState();
    if (!api || !projectRoot) {
      return;
    }
    try {
      await api.duplicate(projectRoot, path);
      await refresh();
    } catch (error) {
      setExplorerError(error);
    }
  };

  const handleReveal = async (path: string) => {
    const { api } = useExplorerStore.getState();
    if (!api) {
      return;
    }
    try {
      await api.reveal(path);
    } catch (error) {
      setExplorerError(error);
    }
  };

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (error) {
      setExplorerError(error);
    }
  };

  const handleRefresh = async () => {
    try {
      await useExplorerStore.getState().refresh();
    } catch (error) {
      setExplorerError(error);
    }
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
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        onContextMenu={(event) => {
          setContextTarget(resolveContextTarget(event, targetPath));
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className={explorerContextMenuClassName}>
        {contextTarget ? (
          <>
            {kind === "folder" || kind === "empty" ? (
              <>
                <ContextMenuItem
                  onClick={() => void handleNewFile(parentForTarget(contextTarget))}
                >
                  <FilePlus className="size-3.5" aria-hidden />
                  New File
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => void handleNewFolder(parentForTarget(contextTarget))}
                >
                  <FolderPlus className="size-3.5" aria-hidden />
                  New Folder
                </ContextMenuItem>
              </>
            ) : null}
            {kind === "folder" || kind === "file" ? (
              <>
                {kind === "folder" ? <ContextMenuSeparator /> : null}
                <ContextMenuItem
                  onClick={() => useExplorerStore.getState().startRename(contextTarget.path)}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => void handleDuplicate(contextTarget.path)}
                >
                  <Copy className="size-3.5" aria-hidden />
                  Duplicate
                </ContextMenuItem>
                <ContextMenuItem
                  variant="destructive"
                  onClick={() => void handleDelete(contextTarget.path)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => void handleReveal(contextTarget.path)}>
                  <FolderOpen className="size-3.5" aria-hidden />
                  Reveal in Finder
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void handleCopyPath(contextTarget.path)}>
                  <ClipboardCopy className="size-3.5" aria-hidden />
                  Copy Path
                </ContextMenuItem>
              </>
            ) : null}
            {kind === "folder" || kind === "empty" ? (
              <>
                {kind === "folder" ? <ContextMenuSeparator /> : null}
                <ContextMenuItem onClick={() => void handleRefresh()}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Refresh
                </ContextMenuItem>
              </>
            ) : null}
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
