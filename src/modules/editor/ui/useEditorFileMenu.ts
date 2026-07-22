import { useEffect, useRef } from "react";
import type { EditorFilePicker } from "../infrastructure/editorFilePicker";
import { createTauriEditorFilePicker } from "../infrastructure/editorFilePicker";
import { openEditorFilesFromPicker } from "./openEditorFiles";

export function useEditorFileMenu(picker?: EditorFilePicker) {
  const defaultPickerRef = useRef<EditorFilePicker | null>(null);
  if (!defaultPickerRef.current) {
    defaultPickerRef.current = createTauriEditorFilePicker();
  }
  const resolvedPicker = picker ?? defaultPickerRef.current;

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const { Menu, MenuItem, Submenu } = await import("@tauri-apps/api/menu");
      const openItem = await MenuItem.new({
        id: "editor-open",
        text: "Open…",
        accelerator: "CmdOrCtrl+O",
        action: () => {
          void openEditorFilesFromPicker(resolvedPicker);
        },
      });
      const file = await Submenu.new({
        text: "File",
        items: [openItem],
      });
      const menu = await Menu.new({ items: [file] });
      if (!disposed) {
        await menu.setAsAppMenu();
      }
    })();
    return () => {
      disposed = true;
    };
  }, [resolvedPicker]);
}
