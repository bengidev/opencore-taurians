import { useState } from "react";
import { useEditorStore } from "../state/editorStore";
import { EditorCloseTabDialog } from "./EditorCloseTabDialog";
import { EditorTabStrip } from "./EditorTabStrip";

export function EditorCardHeader() {
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);

  const onRequestCloseTab = (path: string) => {
    const buf = useEditorStore.getState().buffers[path];
    if (!buf?.dirty) {
      useEditorStore.getState().closeTab(path);
      return;
    }
    setPendingClosePath(path);
  };

  return (
    <>
      <EditorTabStrip onRequestCloseTab={onRequestCloseTab} />
      <EditorCloseTabDialog
        path={pendingClosePath}
        onOpenChange={(open) => {
          if (!open) {
            setPendingClosePath(null);
          }
        }}
      />
    </>
  );
}
