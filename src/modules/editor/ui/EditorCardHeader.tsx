import { useState } from "react";
import { useEditorStore } from "../state/editorStore";
import { EditorCloseTabDialog } from "./EditorCloseTabDialog";
import { EditorTabStrip } from "./EditorTabStrip";

export function EditorCardHeader() {
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);

  const onRequestCloseTab = (id: string) => {
    const buf = useEditorStore.getState().buffers[id];
    if (!buf?.dirty) {
      useEditorStore.getState().closeTab(id);
      return;
    }
    setPendingCloseId(id);
  };

  return (
    <>
      <EditorTabStrip onRequestCloseTab={onRequestCloseTab} />
      <EditorCloseTabDialog
        id={pendingCloseId}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCloseId(null);
          }
        }}
      />
    </>
  );
}
