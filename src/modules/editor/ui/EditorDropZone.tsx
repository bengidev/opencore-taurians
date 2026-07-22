import { useCallback, useState, type DragEvent, type ReactNode } from "react";
import { useShellStore } from "../../shell/state/shellStore";
import {
  EXPLORER_FILE_PATH_MIME,
  getExplorerFileDragPath,
} from "../dnd/explorerFileDrag";
import { useEditorStore } from "../state/editorStore";
import { useEditorOsFileDrop } from "./useEditorOsFileDrop";

function focusEditorCard(): void {
  const { activeMainCard, setActiveMainCard } = useShellStore.getState();
  if (activeMainCard !== "editor") {
    setActiveMainCard("editor");
  }
}

export function EditorDropZone({ children }: { children: ReactNode }) {
  const [mimeDropActive, setMimeDropActive] = useState(false);
  const [osDropActive, setOsDropActive] = useState(false);

  const onDropPaths = useCallback(async (paths: string[]) => {
    const ok = await useEditorStore.getState().openPaths(paths);
    if (ok) {
      focusEditorCard();
    }
    return ok;
  }, []);

  useEditorOsFileDrop({
    setOsDropActive,
    onDropPaths,
  });

  const hasExplorerFileMime = (dataTransfer: DataTransfer): boolean =>
    dataTransfer.types.includes(EXPLORER_FILE_PATH_MIME);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasExplorerFileMime(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setMimeDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setMimeDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasExplorerFileMime(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setMimeDropActive(false);

    const path = getExplorerFileDragPath(event.dataTransfer);
    const projectRoot = useEditorStore.getState().projectRoot;
    if (!path || !projectRoot) {
      return;
    }

    void useEditorStore
      .getState()
      .openFile(projectRoot, path)
      .then((ok) => {
        if (ok) {
          focusEditorCard();
        }
      })
      .catch(() => {});
  };

  return (
    <div
      data-editor-drop-zone=""
      data-drop-active={mimeDropActive || osDropActive || undefined}
      className="flex min-h-0 min-w-0 flex-1 flex-col data-[drop-active]:rounded-[6px] data-[drop-active]:bg-muted/60"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
