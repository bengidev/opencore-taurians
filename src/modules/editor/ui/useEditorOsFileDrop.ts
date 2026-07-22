import { useEffect } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useEditorStore } from "../state/editorStore";

export function useEditorOsFileDrop(options?: {
  onDropPaths?: (paths: string[]) => Promise<boolean>;
  setOsDropActive?: (active: boolean) => void;
}) {
  useEffect(() => {
    let unDrop: UnlistenFn | undefined;
    let unDrag: UnlistenFn | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unDrop = await listen<{ paths: string[]; x: number; y: number }>(
        "explorer://drop",
        (event) => {
          const { paths, x, y } = event.payload;
          const hit = document.elementFromPoint(x, y)?.closest("[data-editor-drop-zone]");
          if (!hit) return;
          void (options?.onDropPaths ?? ((p) => useEditorStore.getState().openPaths(p)))(
            paths,
          );
        },
      );
      unDrag = await listen<{
        phase: string;
        paths: string[];
        x: number;
        y: number;
      }>("explorer://drag", (event) => {
        const { phase, x, y } = event.payload;
        if (phase === "leave") {
          options?.setOsDropActive?.(false);
          return;
        }
        const hit = document.elementFromPoint(x, y)?.closest("[data-editor-drop-zone]");
        options?.setOsDropActive?.(Boolean(hit));
      });
    })();
    return () => {
      unDrop?.();
      unDrag?.();
    };
  }, [options?.onDropPaths, options?.setOsDropActive]);
}
