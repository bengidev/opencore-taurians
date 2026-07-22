import { create } from "zustand";
import type { EditorApi } from "../api/editorApi";

export type EditorStatus = "idle" | "loading" | "ready" | "saving" | "error";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface EditorState {
  api: EditorApi | null;
  projectRoot: string | null;
  path: string | null;
  content: string;
  baselineContent: string;
  dirty: boolean;
  status: EditorStatus;
  errorMessage: string | null;
  saveError: string | null;
  bindApi: (api: EditorApi) => void;
  setContentFromEditor: (content: string) => void;
  clearSaveError: () => void;
  /** Save if dirty. Returns false on failure. */
  saveIfDirty: () => Promise<boolean>;
  save: () => Promise<boolean>;
  /**
   * Save current dirty buffer first (if any), then load path.
   * On save-before-switch failure: do not change path; return false.
   */
  openFile: (projectRoot: string, path: string) => Promise<boolean>;
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  api: null,
  projectRoot: null,
  path: null,
  content: "",
  baselineContent: "",
  dirty: false,
  status: "idle",
  errorMessage: null,
  saveError: null,

  bindApi: (api) => set({ api }),

  setContentFromEditor: (content) =>
    set((state) => ({
      content,
      dirty: content !== state.baselineContent,
    })),

  clearSaveError: () => set({ saveError: null }),

  saveIfDirty: async () => {
    if (!get().dirty) {
      return true;
    }
    return get().save();
  },

  save: async () => {
    const { api, path, projectRoot, content } = get();
    if (!api || !path || !projectRoot) {
      return false;
    }

    set({ status: "saving", saveError: null });

    try {
      await api.writeFile(projectRoot, path, content);
      set({
        baselineContent: content,
        dirty: false,
        status: "ready",
        saveError: null,
      });
      return true;
    } catch (error) {
      set({
        saveError: toErrorMessage(error),
        status: "ready",
      });
      return false;
    }
  },

  openFile: async (projectRoot, path) => {
    const state = get();
    if (state.path === path && state.status === "ready") {
      set({ saveError: null });
      return true;
    }

    const saved = await get().saveIfDirty();
    if (!saved) {
      return false;
    }

    set({
      projectRoot,
      status: "loading",
      errorMessage: null,
      saveError: null,
    });

    const api = get().api;
    if (!api) {
      set({
        path,
        content: "",
        baselineContent: "",
        dirty: false,
        status: "error",
        errorMessage: "Editor API not bound",
      });
      return false;
    }

    try {
      const content = await api.readFile(projectRoot, path);
      set({
        path,
        content,
        baselineContent: content,
        dirty: false,
        status: "ready",
        errorMessage: null,
        saveError: null,
      });
      return true;
    } catch (error) {
      set({
        path,
        content: "",
        baselineContent: "",
        dirty: false,
        status: "error",
        errorMessage: toErrorMessage(error),
      });
      return false;
    }
  },
}));
