import { useState, type DragEvent } from "react";
import { useShellStore } from "../../shell/state/shellStore";
import {
  EXPLORER_FILE_PATH_MIME,
  getExplorerFileDragPath,
} from "../dnd/explorerFileDrag";
import { tabLabel } from "../state/editorTabId";
import { useEditorStore } from "../state/editorStore";

export interface EditorTabStripProps {
  onRequestCloseTab: (id: string) => void;
  onRequestSaveAs: () => void;
}

export function EditorTabStrip({
  onRequestCloseTab,
  onRequestSaveAs,
}: EditorTabStripProps) {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const buffers = useEditorStore((s) => s.buffers);
  const projectRoot = useEditorStore((s) => s.projectRoot);
  const setActiveTabId = useEditorStore((s) => s.setActiveTabId);
  const openFile = useEditorStore((s) => s.openFile);
  const openUntitled = useEditorStore((s) => s.openUntitled);
  const activeMainCard = useShellStore((s) => s.activeMainCard);
  const setActiveMainCard = useShellStore((s) => s.setActiveMainCard);
  const [dropActive, setDropActive] = useState(false);

  const hasExplorerFileMime = (dataTransfer: DataTransfer): boolean =>
    dataTransfer.types.includes(EXPLORER_FILE_PATH_MIME);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasExplorerFileMime(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasExplorerFileMime(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setDropActive(false);

    const path = getExplorerFileDragPath(event.dataTransfer);
    if (!path || !projectRoot) {
      return;
    }

    void openFile(projectRoot, path);
    if (activeMainCard !== "editor") {
      setActiveMainCard("editor");
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Editor tabs"
      data-drop-active={dropActive || undefined}
      className="flex min-w-0 items-center gap-1 data-[drop-active]:rounded-[6px] data-[drop-active]:bg-muted/60"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {tabs.map((tab) => {
        const label = tabLabel(tab.id);
        const dirty = buffers[tab.id]?.dirty ?? false;
        const selected = tab.id === activeTabId;
        const displayLabel = dirty ? `${label} •` : label;

        return (
          <div key={tab.id} className="flex min-w-0 items-center">
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={displayLabel}
              className="rounded-[6px] border border-transparent px-2 py-0.5 font-mono text-[11px] tracking-[0.02em] text-muted-foreground aria-selected:border-border aria-selected:bg-muted aria-selected:text-foreground"
              onClick={() => setActiveTabId(tab.id)}
            >
              {displayLabel}
            </button>
            <button
              type="button"
              aria-label={`Close ${label}`}
              className="rounded-[6px] px-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onRequestCloseTab(tab.id)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        disabled={!projectRoot}
        aria-label="New untitled file"
        className="rounded-[6px] border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground disabled:opacity-50"
        onClick={() => {
          if (!projectRoot) {
            return;
          }
          openUntitled();
        }}
      >
        +
      </button>
      <button
        type="button"
        disabled={!activeTabId}
        aria-label="Save As…"
        className="rounded-[6px] border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground disabled:opacity-50"
        onClick={() => onRequestSaveAs()}
      >
        Save As…
      </button>
    </div>
  );
}
