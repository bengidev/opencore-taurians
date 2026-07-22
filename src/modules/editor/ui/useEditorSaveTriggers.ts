import { useEffect } from "react";
import { useShellStore } from "../../shell/state/shellStore";
import { useEditorStore } from "../state/editorStore";

export function useEditorSaveTriggers(): void {
  useEffect(() => {
    let prev = useShellStore.getState().activeMainCard;
    return useShellStore.subscribe((state) => {
      if (prev === "editor" && state.activeMainCard !== "editor") {
        void useEditorStore.getState().saveIfDirty();
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
          const ok = await useEditorStore.getState().saveAllDirty();
          if (!ok) {
            event.preventDefault();
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
