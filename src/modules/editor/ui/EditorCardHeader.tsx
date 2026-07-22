import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../state/editorStore";
import { EditorCloseTabDialog } from "./EditorCloseTabDialog";
import { EditorSaveAsDialog } from "./EditorSaveAsDialog";
import { EditorTabStrip } from "./EditorTabStrip";
import {
  registerQuitUntitledHandler,
  registerSaveAsRequestHandler,
  type QuitUntitledResult,
} from "./saveAsPromptBridge";

export function EditorCardHeader() {
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [pendingSaveAsSourceId, setPendingSaveAsSourceId] = useState<
    string | null
  >(null);
  const [pendingQuitUntitledId, setPendingQuitUntitledId] = useState<
    string | null
  >(null);
  const saveAsOnSuccessRef = useRef<((savedPath: string) => void) | null>(null);
  const pendingCloseAfterSaveAsIdRef = useRef<string | null>(null);
  const quitResolverRef = useRef<((result: QuitUntitledResult) => void) | null>(
    null,
  );
  const quitPendingIdRef = useRef<string | null>(null);
  const quitSaveAsHandoffRef = useRef(false);

  useEffect(() => {
    registerSaveAsRequestHandler((id) => {
      saveAsOnSuccessRef.current = null;
      pendingCloseAfterSaveAsIdRef.current = null;
      setPendingSaveAsSourceId(id);
    });
    registerQuitUntitledHandler((id) => {
      return new Promise<QuitUntitledResult>((resolve) => {
        quitResolverRef.current = resolve;
        quitPendingIdRef.current = id;
        setPendingQuitUntitledId(id);
      });
    });
    return () => {
      registerSaveAsRequestHandler(null);
      registerQuitUntitledHandler(null);
    };
  }, []);

  const resolveQuit = (result: QuitUntitledResult) => {
    quitResolverRef.current?.(result);
    quitResolverRef.current = null;
    quitPendingIdRef.current = null;
    setPendingQuitUntitledId(null);
  };

  const onRequestCloseTab = (id: string) => {
    const buf = useEditorStore.getState().buffers[id];
    if (!buf?.dirty) {
      useEditorStore.getState().closeTab(id);
      return;
    }
    setPendingCloseId(id);
  };

  const onRequestSaveAs = () => {
    const activeTabId = useEditorStore.getState().activeTabId;
    if (!activeTabId) {
      return;
    }
    saveAsOnSuccessRef.current = null;
    pendingCloseAfterSaveAsIdRef.current = null;
    setPendingSaveAsSourceId(activeTabId);
  };

  const onRequestSaveAsForClose = (id: string) => {
    pendingCloseAfterSaveAsIdRef.current = id;
    setPendingSaveAsSourceId(id);
  };

  const handleQuitSave = (id: string) => {
    saveAsOnSuccessRef.current = () => {
      resolveQuit("saved");
    };
    quitSaveAsHandoffRef.current = true;
    setPendingQuitUntitledId(null);
    setPendingSaveAsSourceId(id);
  };

  const handleQuitDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (quitSaveAsHandoffRef.current) {
        quitSaveAsHandoffRef.current = false;
        return;
      }
      handleQuitCancel();
    }
  };

  const handleQuitDontSave = (id: string) => {
    useEditorStore.getState().closeTab(id);
    resolveQuit("discarded");
  };

  const handleQuitCancel = () => {
    resolveQuit("cancelled");
  };

  const handleSaveAsOpenChange = (open: boolean) => {
    if (!open) {
      if (quitPendingIdRef.current && quitResolverRef.current) {
        resolveQuit("cancelled");
      }
      pendingCloseAfterSaveAsIdRef.current = null;
      setPendingSaveAsSourceId(null);
      saveAsOnSuccessRef.current = null;
    }
  };

  const handleSaveAsSuccess = (savedPath: string) => {
    if (pendingCloseAfterSaveAsIdRef.current) {
      useEditorStore.getState().closeTab(savedPath);
      pendingCloseAfterSaveAsIdRef.current = null;
    }
    saveAsOnSuccessRef.current?.(savedPath);
    saveAsOnSuccessRef.current = null;
  };

  const handleSaveAsFailure = () => {
    if (quitPendingIdRef.current && quitResolverRef.current) {
      resolveQuit("failed");
      saveAsOnSuccessRef.current = null;
      return;
    }
  };

  return (
    <>
      <EditorTabStrip
        onRequestCloseTab={onRequestCloseTab}
        onRequestSaveAs={onRequestSaveAs}
      />
      <EditorCloseTabDialog
        id={pendingCloseId}
        onRequestSaveAsForClose={onRequestSaveAsForClose}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCloseId(null);
          }
        }}
      />
      {pendingQuitUntitledId ? (
        <EditorCloseTabDialog
          id={pendingQuitUntitledId}
          onRequestSaveAsForClose={handleQuitSave}
          onDontSave={handleQuitDontSave}
          onCancel={handleQuitCancel}
          onOpenChange={handleQuitDialogOpenChange}
        />
      ) : null}
      <EditorSaveAsDialog
        sourceId={pendingSaveAsSourceId}
        onOpenChange={handleSaveAsOpenChange}
        onSuccess={handleSaveAsSuccess}
        onFailure={handleSaveAsFailure}
      />
    </>
  );
}
