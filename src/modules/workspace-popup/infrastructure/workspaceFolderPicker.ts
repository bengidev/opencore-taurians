export interface FolderPicker {
  pickFolder(): Promise<string | null>;
}

export function createMemoryFolderPicker(
  result: string | null,
): FolderPicker {
  return {
    async pickFolder() {
      return result;
    },
  };
}

export function createTauriFolderPicker(): FolderPicker {
  return {
    async pickFolder() {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected === null) return null;
      if (Array.isArray(selected)) return selected[0] ?? null;
      return selected;
    },
  };
}
