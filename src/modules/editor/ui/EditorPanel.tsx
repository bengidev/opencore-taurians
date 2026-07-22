import { Suspense, lazy, useEffect } from "react";
import { createTauriEditorApi } from "../api/editorApi";
import { useEditorStore } from "../state/editorStore";
import { useEditorSaveTriggers } from "./useEditorSaveTriggers";

const MonacoEditorHost = lazy(() =>
  import("./MonacoEditorHost").then((module) => ({ default: module.MonacoEditorHost })),
);

export function EditorPanel() {
  useEditorSaveTriggers();

  const activeTabId = useEditorStore((s) => s.activeTabId);
  const buffer = useEditorStore((s) =>
    s.activeTabId ? (s.buffers[s.activeTabId] ?? null) : null,
  );

  useEffect(() => {
    const { api, bindApi } = useEditorStore.getState();
    if (!api) {
      bindApi(createTauriEditorApi());
    }
  }, []);

  if (!activeTabId || !buffer) {
    return (
      <p className="mt-2 font-mono text-sm text-muted-foreground">
        Open a file from the explorer
      </p>
    );
  }

  if (buffer.status === "loading") {
    return (
      <p className="mt-2 font-mono text-sm text-muted-foreground">Loading…</p>
    );
  }

  if (buffer.status === "error") {
    return (
      <p className="mt-2 font-mono text-sm text-destructive">{buffer.errorMessage}</p>
    );
  }

  if (buffer.status !== "ready" && buffer.status !== "saving") {
    return null;
  }

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col">
      {buffer.status === "saving" ? (
        <p className="mb-1 font-mono text-xs text-muted-foreground">Saving…</p>
      ) : null}
      {buffer.saveError ? (
        <p className="mb-1 font-mono text-xs text-muted-foreground">{buffer.saveError}</p>
      ) : null}
      <Suspense
        fallback={
          <p className="font-mono text-sm text-muted-foreground">Loading editor…</p>
        }
      >
        <MonacoEditorHost />
      </Suspense>
    </div>
  );
}
