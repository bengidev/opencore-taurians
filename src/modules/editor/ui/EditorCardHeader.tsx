import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../state/editorStore";
import {
  promptCloseTab,
  registerCloseTabPromptHandler,
  type CloseTabPromptResult,
} from "./closeTabPromptBridge";
import { EditorCloseTabDialog } from "./EditorCloseTabDialog";
import { EditorSaveAsDialog } from "./EditorSaveAsDialog";
import { EditorTabStrip } from "./EditorTabStrip";
import { useEditorOsFileDrop } from "./useEditorOsFileDrop";
import {
  registerQuitUntitledHandler,
  registerSaveAsRequestHandler,
  type QuitUntitledResult,
} from "./saveAsPromptBridge";

export function EditorCardHeader() {
  const [osDropActive, setOsDropActive] = useState(false);
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
  // Only one promptCloseTab dialog may be in flight; concurrent calls are unsupported.
  const closePromptResolverRef = useRef<
    ((result: CloseTabPromptResult) => void) | null
  >(null);
  const closeSaveAsHandoffRef = useRef(false);
  const closingTabsRef = useRef(false);

  useEditorOsFileDrop({ setOsDropActive });

  const resolveClosePrompt = (result: CloseTabPromptResult) => {
    closePromptResolverRef.current?.(result);
    closePromptResolverRef.current = null;
  };

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
    registerCloseTabPromptHandler(async (id) => {
      const buf = useEditorStore.getState().buffers[id];
      if (!buf) {
        return "closed";
      }
      if (!buf.dirty) {
        useEditorStore.getState().closeTab(id);
        return "closed";
      }
      return new Promise<CloseTabPromptResult>((resolve) => {
        closePromptResolverRef.current = resolve;
        setPendingCloseId(id);
      });
    });
    return () => {
      registerSaveAsRequestHandler(null);
      registerQuitUntitledHandler(null);
      registerCloseTabPromptHandler(null);
    };
  }, []);

  const resolveQuit = (result: QuitUntitledResult) => {
    quitResolverRef.current?.(result);
    quitResolverRef.current = null;
    quitPendingIdRef.current = null;
    setPendingQuitUntitledId(null);
  };

  const onRequestCloseTab = (id: string) => {
    void promptCloseTab(id);
  };

  async function closeTabsSequentially(ids: string[]): Promise<void> {
    if (closingTabsRef.current) return;
    closingTabsRef.current = true;
    try {
      for (const id of ids) {
        if (!useEditorStore.getState().tabs.some((t) => t.id === id)) continue;
        const result = await promptCloseTab(id);
        if (result === "cancelled") return;
      }
    } finally {
      closingTabsRef.current = false;
    }
  }

  const onRequestCloseOthers = (keepId: string) => {
    const ids = useEditorStore
      .getState()
      .tabs.map((t) => t.id)
      .filter((id) => id !== keepId);
    void closeTabsSequentially(ids);
  };

  const onRequestCloseAll = () => {
    const ids = useEditorStore.getState().tabs.map((t) => t.id);
    void closeTabsSequentially(ids);
  };

  const onRequestSaveAs = (id: string) => {
    saveAsOnSuccessRef.current = null;
    pendingCloseAfterSaveAsIdRef.current = null;
    setPendingSaveAsSourceId(id);
  };

  const onRequestSaveAsForClose = (id: string) => {
    pendingCloseAfterSaveAsIdRef.current = id;
    closeSaveAsHandoffRef.current = true;
    setPendingSaveAsSourceId(id);
  };

  const handleCloseDontSave = (id: string) => {
    useEditorStore.getState().closeTab(id);
    setPendingCloseId(null);
    resolveClosePrompt("closed");
  };

  const handleCloseCancel = () => {
    setPendingCloseId(null);
    resolveClosePrompt("cancelled");
  };

  const handleCloseDialogOpenChange = (open: boolean) => {
    if (!open) {
      if (closeSaveAsHandoffRef.current) {
        closeSaveAsHandoffRef.current = false;
        setPendingCloseId(null);
        return;
      }
      const id = pendingCloseId;
      setPendingCloseId(null);
      if (id && !useEditorStore.getState().buffers[id]) {
        resolveClosePrompt("closed");
      } else {
        resolveClosePrompt("cancelled");
      }
    }
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
      if (closePromptResolverRef.current && pendingCloseAfterSaveAsIdRef.current) {
        resolveClosePrompt("cancelled");
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
      resolveClosePrompt("closed");
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
        osDropActive={osDropActive}
        onRequestCloseTab={onRequestCloseTab}
        onRequestSaveAs={onRequestSaveAs}
        onRequestCloseOthers={onRequestCloseOthers}
        onRequestCloseAll={onRequestCloseAll}
      />
      <EditorCloseTabDialog
        id={pendingCloseId}
        onRequestSaveAsForClose={onRequestSaveAsForClose}
        onDontSave={handleCloseDontSave}
        onCancel={handleCloseCancel}
        onOpenChange={handleCloseDialogOpenChange}
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
