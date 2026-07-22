import { Suspense, lazy, useEffect } from "react";
import { createTauriEditorApi } from "../api/editorApi";
import { useEditorStore } from "../state/editorStore";
import { useEditorSaveTriggers } from "./useEditorSaveTriggers";

const MonacoEditorHost = lazy(() =>
  import("./MonacoEditorHost").then((module) => ({ default: module.MonacoEditorHost })),
);

export function EditorPanel() {
  useEditorSaveTriggers();

  const path = useEditorStore((s) => s.path);
  const status = useEditorStore((s) => s.status);
  const errorMessage = useEditorStore((s) => s.errorMessage);
  const saveError = useEditorStore((s) => s.saveError);

  useEffect(() => {
    const { api, bindApi } = useEditorStore.getState();
    if (!api) {
      bindApi(createTauriEditorApi());
    }
  }, []);

  if (!path) {
    return (
      <p className="mt-2 font-mono text-sm text-muted-foreground">
        Open a file from the explorer
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className="mt-2 font-mono text-sm text-muted-foreground">Loading…</p>
    );
  }

  if (status === "error") {
    return (
      <p className="mt-2 font-mono text-sm text-destructive">{errorMessage}</p>
    );
  }

  if (status !== "ready" && status !== "saving") {
    return null;
  }

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col">
      {status === "saving" ? (
        <p className="mb-1 font-mono text-xs text-muted-foreground">Saving…</p>
      ) : null}
      {saveError ? (
        <p className="mb-1 font-mono text-xs text-muted-foreground">{saveError}</p>
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
