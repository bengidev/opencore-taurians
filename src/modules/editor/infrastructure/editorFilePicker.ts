export interface EditorFilePicker {
  pickFiles(): Promise<string[] | null>;
}

export function createMemoryEditorFilePicker(
  result: string[] | null,
): EditorFilePicker {
  return {
    async pickFiles() {
      return result;
    },
  };
}

export function createTauriEditorFilePicker(): EditorFilePicker {
  return {
    async pickFiles() {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true, directory: false });
      if (selected === null) return null;
      return Array.isArray(selected) ? selected : [selected];
    },
  };
}
