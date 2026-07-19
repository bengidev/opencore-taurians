import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "../../editor/state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import type { ExplorerEntry } from "../domain/explorerTypes";
import { useExplorerStore } from "../state/explorerStore";
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
  const toggleExpanded = useExplorerStore((s) => s.toggleExpanded);
  const selectPath = useExplorerStore((s) => s.selectPath);

  const expanded = expandedPaths.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isRenaming = renamingPath === entry.path;
  const children = childrenByPath[entry.path] ?? [];

  if (entry.isDir) {
    return (
      <li className="min-w-0">
        <div
          className="flex min-w-0 w-full items-center gap-0.5"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          data-explorer-path={entry.path}
        >
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => void toggleExpanded(entry.path)}
          >
            {expanded ? (
              <ChevronDown className="size-3" aria-hidden />
            ) : (
              <ChevronRight className="size-3" aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-current={isSelected ? "true" : undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-sm px-1 py-1 text-left font-mono text-[11px]",
              isSelected
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            onClick={() => selectPath(entry.path)}
          >
            <Folder className="size-3 shrink-0" aria-hidden />
            {isRenaming ? (
              <ExplorerRenameInput initialName={entry.name} />
            ) : (
              <span className="truncate">{entry.name}</span>
            )}
          </button>
        </div>
        {expanded ? (
          <ul className="list-none">
            {children.map((child) => (
              <ExplorerEntryRow key={child.path} entry={child} depth={depth + 1} />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <div
        className="flex min-w-0 w-full items-center gap-0.5"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        data-explorer-path={entry.path}
      >
        <span className="size-4 shrink-0" aria-hidden />
        <button
          type="button"
          aria-current={isSelected ? "true" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-sm px-1 py-1 text-left font-mono text-[11px]",
            isSelected
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          onClick={() => {
            selectPath(entry.path);
            openFile(entry.path);
          }}
        >
          <File className="size-3 shrink-0" aria-hidden />
          {isRenaming ? (
            <ExplorerRenameInput initialName={entry.name} />
          ) : (
            <span className="truncate">{entry.name}</span>
          )}
        </button>
      </div>
    </li>
  );
}

export function ExplorerTree() {
  const projectRoot = useExplorerStore((s) => s.projectRoot);
  const childrenByPath = useExplorerStore((s) => s.childrenByPath);

  if (!projectRoot) {
    return null;
  }

  const rootChildren = childrenByPath[projectRoot] ?? [];

  return (
    <ul aria-label="explorer tree" className="list-none">
      {rootChildren.map((entry) => (
        <ExplorerEntryRow key={entry.path} entry={entry} depth={0} />
      ))}
    </ul>
  );
}
