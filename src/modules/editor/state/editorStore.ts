import { create } from "zustand";

export interface EditorState {
  openFilePath: string | null;
  setOpenFilePath: (path: string | null) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  openFilePath: null,
  setOpenFilePath: (path) => set({ openFilePath: path }),
}));
