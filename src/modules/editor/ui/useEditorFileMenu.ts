import { useEffect, useRef } from "react";
import type { EditorFilePicker } from "../infrastructure/editorFilePicker";
import { createTauriEditorFilePicker } from "../infrastructure/editorFilePicker";
import { useEditorStore } from "../state/editorStore";
import { performEditorSave, performEditorSaveAs } from "./editorSaveActions";
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
      const { Menu, MenuItem, PredefinedMenuItem, Submenu } = await import(
        "@tauri-apps/api/menu"
      );
      // macOS absorbs the first root submenu into the app-name menu regardless of
      // its text — keep a dedicated App submenu first so File stays its own menu.
      const app = await Submenu.new({
        text: "App",
        items: [
          await PredefinedMenuItem.new({ item: { About: null } }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Services" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Hide" }),
          await PredefinedMenuItem.new({ item: "HideOthers" }),
          await PredefinedMenuItem.new({ item: "ShowAll" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Quit" }),
        ],
      });
      const newItem = await MenuItem.new({
        id: "editor-new",
        text: "New",
        accelerator: "CmdOrCtrl+N",
        action: () => {
          useEditorStore.getState().openUntitled();
        },
      });
      const openItem = await MenuItem.new({
        id: "editor-open",
        text: "Open…",
        accelerator: "CmdOrCtrl+O",
        action: () => {
          void openEditorFilesFromPicker(resolvedPicker);
        },
      });
      const saveItem = await MenuItem.new({
        id: "editor-save",
        text: "Save",
        accelerator: "CmdOrCtrl+S",
        action: () => {
          performEditorSave();
        },
      });
      const saveAsItem = await MenuItem.new({
        id: "editor-save-as",
        text: "Save As…",
        accelerator: "CmdOrCtrl+Shift+S",
        action: () => {
          performEditorSaveAs();
        },
      });
      const file = await Submenu.new({
        text: "File",
        items: [newItem, openItem, saveItem, saveAsItem],
      });
      const menu = await Menu.new({ items: [app, file] });
      if (!disposed) {
        await menu.setAsAppMenu();
      }
    })();
    return () => {
      disposed = true;
    };
  }, [resolvedPicker]);
}
