import type { EditorFilePicker } from "../infrastructure/editorFilePicker";
import { useEditorStore } from "../state/editorStore";

export async function openEditorFilesFromPicker(
  picker: EditorFilePicker,
): Promise<void> {
  const paths = await picker.pickFiles();
  if (paths === null) return;
  await useEditorStore.getState().openPaths(paths);
}
