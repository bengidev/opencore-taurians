import { useEffect } from "react";
import type { EditorFilePicker } from "../infrastructure/editorFilePicker";
import { createTauriEditorFilePicker } from "../infrastructure/editorFilePicker";
import { openEditorFilesFromPicker } from "./openEditorFiles";

export function useEditorFileMenu(
  picker: EditorFilePicker = createTauriEditorFilePicker(),
) {
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const { Menu, MenuItem, Submenu } = await import("@tauri-apps/api/menu");
      const openItem = await MenuItem.new({
        id: "editor-open",
        text: "Open…",
        accelerator: "CmdOrCtrl+O",
        action: () => {
          void openEditorFilesFromPicker(picker);
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
  }, [picker]);
}
