import { createContext, useContext, useEffect, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { resolveExplorerIcon } from "@/lib/fileIcons";
import { cn } from "@/lib/utils";
import { collectDirtyExplorerPaths } from "../../editor/domain/collectDirtyExplorerPaths";
import { useEditorStore } from "../../editor/state/editorStore";
import { setExplorerFileDragData } from "../../editor/dnd/explorerFileDrag";
import { useShellStore } from "../../shell/state/shellStore";
import type { ExplorerEntry } from "../domain/explorerTypes";
import { filterExplorerTree } from "../domain/filterExplorerTree";
import { useExplorerStore } from "../state/explorerStore";
import {
  explorerChevronClassName,
  explorerMaterialIconClassName,
  explorerRowButtonClassName,
  explorerTreeChildrenGridClassName,
  explorerTreeChildrenInnerClassName,
} from "./explorerStyles";
import { ExplorerRenameInput } from "./ExplorerRenameInput";

interface ExplorerEntryRowProps {
  entry: ExplorerEntry;
  depth: number;
}

type ExplorerTreeView = {
  childrenByPath: Record<string, ExplorerEntry[]>;
  isExpanded: (path: string) => boolean;
  dirtyPaths: Set<string>;
};

const ExplorerTreeViewContext = createContext<ExplorerTreeView | null>(null);

function useExplorerTreeView(): ExplorerTreeView {
  const value = useContext(ExplorerTreeViewContext);
  if (!value) {
    throw new Error("ExplorerEntryRow must render inside ExplorerTree");
  }
  return value;
}

function openFile(path: string): void {
  useShellStore.getState().setActiveMainCard("editor");
  const projectRoot = useExplorerStore.getState().projectRoot;
  if (!projectRoot) return;
  void useEditorStore.getState().openFile(projectRoot, path);
}

function ExplorerEntryIcon({
  name,
  isDir,
  isOpen,
}: {
  name: string;
  isDir: boolean;
  isOpen?: boolean;
}) {
  const { src } = resolveExplorerIcon({ name, isDir, isOpen });
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={explorerMaterialIconClassName}
    />
  );
}

function ExplorerEntryRow({ entry, depth }: ExplorerEntryRowProps) {
  const treeView = useExplorerTreeView();
  const selectedPath = useExplorerStore((s) => s.selectedPath);
  const renamingPath = useExplorerStore((s) => s.renamingPath);
  const loadingPaths = useExplorerStore((s) => s.loadingPaths);
  const toggleExpanded = useExplorerStore((s) => s.toggleExpanded);
  const selectPath = useExplorerStore((s) => s.selectPath);

  const expanded = treeView.isExpanded(entry.path);
  const isSelected = selectedPath === entry.path;
  const isRenaming = renamingPath === entry.path;
  const children = treeView.childrenByPath[entry.path] ?? [];
  const isLoadingChildren = loadingPaths.has(entry.path);
  const rowButtonClassName = explorerRowButtonClassName(isSelected);
  const dirty = treeView.dirtyPaths.has(entry.path);
  const displayName = dirty ? `${entry.name} •` : entry.name;

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
              <ExplorerEntryIcon name={entry.name} isDir isOpen={false} />
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
              <ExplorerEntryIcon
                name={entry.name}
                isDir
                isOpen={expanded}
              />
              <span className="truncate">{displayName}</span>
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
            <ExplorerEntryIcon name={entry.name} isDir={false} />
            <ExplorerRenameInput initialName={entry.name} />
          </div>
        ) : (
          <button
            type="button"
            aria-current={isSelected ? "true" : undefined}
            className={rowButtonClassName}
            draggable
            onDragStart={(event) => {
              setExplorerFileDragData(event.dataTransfer, entry.path);
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => {
              selectPath(entry.path);
              openFile(entry.path);
            }}
          >
            <ExplorerEntryIcon name={entry.name} isDir={false} />
            <span className="truncate">{displayName}</span>
          </button>
        )}
      </div>
    </li>
  );
}

export function ExplorerTree() {
  const projectRoot = useExplorerStore((s) => s.projectRoot);
  const childrenByPath = useExplorerStore((s) => s.childrenByPath);
  const expandedPaths = useExplorerStore((s) => s.expandedPaths);
  const loadingPaths = useExplorerStore((s) => s.loadingPaths);
  const searchQuery = useExplorerStore((s) => s.searchQuery);
  const searchIndexing = useExplorerStore((s) => s.searchIndexing);
  const ensureSearchTreeLoaded = useExplorerStore((s) => s.ensureSearchTreeLoaded);
  const editorBuffers = useEditorStore((s) => s.buffers);
  const editorProjectRoot = useEditorStore((s) => s.projectRoot);
  const hasSearchQuery = searchQuery.trim().length > 0;

  const dirtyPaths = useMemo(
    () => collectDirtyExplorerPaths(editorBuffers, editorProjectRoot),
    [editorBuffers, editorProjectRoot],
  );

  useEffect(() => {
    if (!projectRoot || !hasSearchQuery) {
      return;
    }
    void ensureSearchTreeLoaded();
  }, [projectRoot, hasSearchQuery, ensureSearchTreeLoaded]);

  const treeView = useMemo<ExplorerTreeView | null>(() => {
    if (!projectRoot) {
      return null;
    }
    const filtered = filterExplorerTree({
      childrenByPath,
      rootPath: projectRoot,
      query: searchQuery,
    });
    if (!filtered) {
      return {
        childrenByPath,
        isExpanded: (path) => expandedPaths.has(path),
        dirtyPaths,
      };
    }
    return {
      childrenByPath: filtered.childrenByPath,
      isExpanded: (path) =>
        expandedPaths.has(path) || filtered.displayOpenPaths.has(path),
      dirtyPaths,
    };
  }, [projectRoot, childrenByPath, expandedPaths, searchQuery, dirtyPaths]);

  if (!projectRoot || !treeView) {
    return null;
  }

  const rootChildren = treeView.childrenByPath[projectRoot] ?? [];
  const isLoadingRoot = loadingPaths.has(projectRoot);
  const isFiltering = searchQuery.trim().length > 0;

  if (rootChildren.length === 0 && !isLoadingRoot) {
    return (
      <p className="px-3 py-6 text-center font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
        {isFiltering
          ? searchIndexing
            ? "Searching…"
            : "No matching files."
          : "This folder is empty."}
        {!isFiltering ? (
          <span className="mt-1 block text-[10px] text-muted-foreground/70">
            Right-click to create a file or folder.
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <ExplorerTreeViewContext.Provider value={treeView}>
      <ul aria-label="explorer tree" className="list-none py-0.5">
        {rootChildren.map((entry) => (
          <ExplorerEntryRow key={entry.path} entry={entry} depth={0} />
        ))}
      </ul>
    </ExplorerTreeViewContext.Provider>
  );
}
