import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useExplorerStore } from "../../explorer/state/explorerStore";
import { useShellStore } from "../../shell/state/shellStore";
import {
  clearExplorerFileDrag,
  getActiveExplorerFileDragPath,
  isExplorerFileDragActive,
} from "../dnd/explorerFileDrag";
import { useEditorStore } from "../state/editorStore";
import { useEditorOsFileDrop } from "./useEditorOsFileDrop";

function focusEditorCard(): void {
  const { activeMainCard, setActiveMainCard } = useShellStore.getState();
  if (activeMainCard !== "editor") {
    setActiveMainCard("editor");
  }
}

/**
 * Editor `projectRoot` is only set after openFile/openPaths. Explorer can already
 * have a root (FILES panel) while the editor card is still empty — use that.
 */
function ensureEditorProjectRoot(): string | null {
  const editorRoot = useEditorStore.getState().projectRoot;
  if (editorRoot) {
    return editorRoot;
  }
  const explorerRoot = useExplorerStore.getState().projectRoot;
  if (explorerRoot) {
    useEditorStore.setState({ projectRoot: explorerRoot });
    return explorerRoot;
  }
  return null;
}

function openExplorerPointerPath(path: string): void {
  const projectRoot = ensureEditorProjectRoot();
  if (!projectRoot) {
    useEditorStore.setState({ openBatchError: "Open a project first" });
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
}

export function EditorDropZone({ children }: { children: ReactNode }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [pointerDropActive, setPointerDropActive] = useState(false);
  const [osDropActive, setOsDropActive] = useState(false);

  const onDropPaths = useCallback(async (paths: string[]) => {
    // Native DragDrop can fire for in-app gestures with an empty path list.
    if (paths.length === 0) {
      return false;
    }
    ensureEditorProjectRoot();
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

  // Pointer-based Explorer→Editor (HTML5 MIME DnD is unreliable in WKWebView).
  useEffect(() => {
    const hitThisZone = (clientX: number, clientY: number): boolean => {
      const zone = zoneRef.current;
      if (!zone) {
        return false;
      }
      const hit = document.elementFromPoint(clientX, clientY);
      return Boolean(hit && zone.contains(hit));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isExplorerFileDragActive()) {
        return;
      }
      setPointerDropActive(hitThisZone(event.clientX, event.clientY));
    };

    const endPointerDrag = (event: PointerEvent) => {
      if (!isExplorerFileDragActive()) {
        return;
      }
      const path = getActiveExplorerFileDragPath();
      const over = hitThisZone(event.clientX, event.clientY);
      clearExplorerFileDrag();
      setPointerDropActive(false);
      if (over && path) {
        openExplorerPointerPath(path);
      }
    };

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", endPointerDrag, true);
    document.addEventListener("pointercancel", endPointerDrag, true);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", endPointerDrag, true);
      document.removeEventListener("pointercancel", endPointerDrag, true);
    };
  }, []);

  return (
    <div
      ref={zoneRef}
      data-editor-drop-zone=""
      data-drop-active={pointerDropActive || osDropActive || undefined}
      className="flex min-h-0 min-w-0 flex-1 flex-col data-[drop-active]:rounded-[6px] data-[drop-active]:bg-muted/60"
    >
      {children}
    </div>
  );
}
