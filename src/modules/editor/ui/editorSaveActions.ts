import { isUntitledId } from "../state/editorTabId";
import { useEditorStore } from "../state/editorStore";
import { requestSaveAs } from "./saveAsPromptBridge";

export function performEditorSave(): void {
  const { activeTabId, buffers, save } = useEditorStore.getState();
  if (!activeTabId) return;
  const buffer = buffers[activeTabId];
  if (!buffer || buffer.readOnly) return;
  if (isUntitledId(activeTabId)) {
    requestSaveAs(activeTabId);
    return;
  }
  void save();
}

export function performEditorSaveAs(): void {
  const { activeTabId, buffers } = useEditorStore.getState();
  if (!activeTabId) return;
  const buffer = buffers[activeTabId];
  if (!buffer || buffer.readOnly) return;
  requestSaveAs(activeTabId);
}
