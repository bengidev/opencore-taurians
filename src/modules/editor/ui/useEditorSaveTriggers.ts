import { useEffect } from "react";
import { useShellStore } from "../../shell/state/shellStore";
import { isUntitledId } from "../state/editorTabId";
import { useEditorStore } from "../state/editorStore";
import {
  promptQuitUntitled,
  requestSaveAs,
} from "./saveAsPromptBridge";

export function useEditorSaveTriggers(): void {
  useEffect(() => {
    let prev = useShellStore.getState().activeMainCard;
    return useShellStore.subscribe((state) => {
      if (prev === "editor" && state.activeMainCard !== "editor") {
        const { activeTabId, buffers } = useEditorStore.getState();
        if (
          activeTabId &&
          isUntitledId(activeTabId) &&
          buffers[activeTabId]?.dirty
        ) {
          requestSaveAs(activeTabId);
        } else {
          void useEditorStore.getState().saveIfDirty();
        }
      }
      prev = state.activeMainCard;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "s") return;
      if (useShellStore.getState().activeMainCard !== "editor") return;
      event.preventDefault();
      const { activeTabId } = useEditorStore.getState();
      if (activeTabId && isUntitledId(activeTabId)) {
        requestSaveAs(activeTabId);
        return;
      }
      void useEditorStore.getState().save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (cancelled) return;
        unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          const ok = await useEditorStore.getState().saveAllDirtyPaths();
          if (!ok) {
            useShellStore.getState().setActiveMainCard("editor");
            event.preventDefault();
            return;
          }
          for (const id of useEditorStore.getState().dirtyUntitledIds()) {
            useShellStore.getState().setActiveMainCard("editor");
            const result = await promptQuitUntitled(id);
            if (result === "cancelled" || result === "failed") {
              event.preventDefault();
              return;
            }
          }
        });
      } catch {
        // non-Tauri test env
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
