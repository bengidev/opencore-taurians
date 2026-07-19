import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "../../editor/state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import type { ExplorerEntry } from "../domain/explorerTypes";
import { useExplorerStore } from "../state/explorerStore";
import {
  explorerChevronClassName,
  explorerIconClassName,
  explorerRowButtonClassName,
  explorerTreeChildrenGridClassName,
  explorerTreeChildrenInnerClassName,
} from "./explorerStyles";
import { ExplorerRenameInput } from "./ExplorerRenameInput";

interface ExplorerEntryRowProps {
  entry: ExplorerEntry;
  depth: number;
}

function openFile(path: string): void {
  useShellStore.getState().setActiveMainCard("editor");
  useEditorStore.getState().setOpenFilePath(path);
}

function ExplorerEntryRow({ entry, depth }: ExplorerEntryRowProps) {
  const expandedPaths = useExplorerStore((s) => s.expandedPaths);
  const selectedPath = useExplorerStore((s) => s.selectedPath);
  const renamingPath = useExplorerStore((s) => s.renamingPath);
  const childrenByPath = useExplorerStore((s) => s.childrenByPath);
  const loadingPaths = useExplorerStore((s) => s.loadingPaths);
  const toggleExpanded = useExplorerStore((s) => s.toggleExpanded);
  const selectPath = useExplorerStore((s) => s.selectPath);

  const expanded = expandedPaths.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isRenaming = renamingPath === entry.path;
  const children = childrenByPath[entry.path] ?? [];
  const isLoadingChildren = loadingPaths.has(entry.path);
  const rowButtonClassName = explorerRowButtonClassName(isSelected);

  if (entry.isDir) {
    return (
      <li className="min-w-0">
        <div
          className="flex min-w-0 w-full items-center"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          data-explorer-path={entry.path}
        >
          {isRenaming ? (
            <div className={cn(rowButtonClassName, "w-full")}>
              <Folder className={explorerIconClassName} aria-hidden />
              <ExplorerRenameInput initialName={entry.name} />
            </div>
          ) : (
            <button
              type="button"
              aria-expanded={expanded}
              aria-current={isSelected ? "true" : undefined}
              aria-busy={isLoadingChildren || undefined}
              className={rowButtonClassName}
              onClick={() => {
                selectPath(entry.path);
                void toggleExpanded(entry.path);
              }}
            >
              <ChevronRight
                className={explorerChevronClassName(expanded)}
                aria-hidden
              />
              {expanded ? (
                <FolderOpen className={explorerIconClassName} aria-hidden />
              ) : (
                <Folder className={explorerIconClassName} aria-hidden />
              )}
              <span className="truncate">{entry.name}</span>
            </button>
          )}
        </div>
        <div
          className={explorerTreeChildrenGridClassName(expanded)}
          aria-hidden={!expanded}
        >
          <div className={explorerTreeChildrenInnerClassName}>
            <ul className="list-none">
              {isLoadingChildren && children.length === 0 ? (
                <li
                  className="py-1 font-mono text-[10px] tracking-[0.08em] text-muted-foreground/70"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }}
                >
                  Loading…
                </li>
              ) : null}
              {children.map((child) => (
                <ExplorerEntryRow key={child.path} entry={child} depth={depth + 1} />
              ))}
            </ul>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <div
        className="flex min-w-0 w-full items-center"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        data-explorer-path={entry.path}
      >
        <span className="size-3 shrink-0" aria-hidden />
        {isRenaming ? (
          <div className={cn(rowButtonClassName, "w-full")}>
            <File className={explorerIconClassName} aria-hidden />
            <ExplorerRenameInput initialName={entry.name} />
          </div>
        ) : (
          <button
            type="button"
            aria-current={isSelected ? "true" : undefined}
            className={rowButtonClassName}
            onClick={() => {
              selectPath(entry.path);
              openFile(entry.path);
            }}
          >
            <File className={explorerIconClassName} aria-hidden />
            <span className="truncate">{entry.name}</span>
          </button>
        )}
      </div>
    </li>
  );
}

export function ExplorerTree() {
  const projectRoot = useExplorerStore((s) => s.projectRoot);
  const childrenByPath = useExplorerStore((s) => s.childrenByPath);
  const loadingPaths = useExplorerStore((s) => s.loadingPaths);

  if (!projectRoot) {
    return null;
  }

  const rootChildren = childrenByPath[projectRoot] ?? [];
  const isLoadingRoot = loadingPaths.has(projectRoot);

  if (rootChildren.length === 0 && !isLoadingRoot) {
    return (
      <p className="px-3 py-6 text-center font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
        This folder is empty.
        <span className="mt-1 block text-[10px] text-muted-foreground/70">
          Right-click to create a file or folder.
        </span>
      </p>
    );
  }

  return (
    <ul aria-label="explorer tree" className="list-none py-0.5">
      {rootChildren.map((entry) => (
        <ExplorerEntryRow key={entry.path} entry={entry} depth={0} />
      ))}
    </ul>
  );
}
