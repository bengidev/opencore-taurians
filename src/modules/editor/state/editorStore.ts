import { create } from "zustand";
import type { EditorApi } from "../api/editorApi";

export type EditorStatus = "idle" | "loading" | "ready" | "saving" | "error";

export interface EditorBuffer {
  content: string;
  baselineContent: string;
  dirty: boolean;
  status: EditorStatus;
  errorMessage: string | null;
  saveError: string | null;
}

export interface EditorTab {
  path: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyBuffer(): EditorBuffer {
  return {
    content: "",
    baselineContent: "",
    dirty: false,
    status: "idle",
    errorMessage: null,
    saveError: null,
  };
}

export interface EditorState {
  api: EditorApi | null;
  projectRoot: string | null;
  tabs: EditorTab[];
  activePath: string | null;
  buffers: Record<string, EditorBuffer>;
  bindApi: (api: EditorApi) => void;
  setContentFromEditor: (content: string) => void;
  clearSaveError: (path?: string) => void;
  /** Active tab only. */
  saveIfDirty: () => Promise<boolean>;
  /** Active tab only. */
  save: () => Promise<boolean>;
  /** Save one tab by path (used by close→Save and quit). */
  saveTab: (path: string) => Promise<boolean>;
  /** Save all dirty tabs in open order. Returns false if any fail; activates first failure. */
  saveAllDirty: () => Promise<boolean>;
  /**
   * Append or focus. Never save-before-switch.
   * Already open + ready: focus, clear that buffer's saveError, do not reload.
   * Already open + error: focus and retry load.
   * New path: append tab, set activePath, load into buffer.
   */
  openFile: (projectRoot: string, path: string) => Promise<boolean>;
  /** Activate an already-open tab (no reload). */
  setActivePath: (path: string) => void;
  /**
   * Remove tab and buffer. If it was active, prefer right neighbor else left;
   * if none left, activePath = null.
   * Caller must only invoke when clean, after Don't save, or after successful Save.
   */
  closeTab: (path: string) => void;
}

type EditorStore = EditorState;

function patchBuffer(
  buffers: Record<string, EditorBuffer>,
  path: string,
  patch: Partial<EditorBuffer>,
): Record<string, EditorBuffer> {
  const current = buffers[path] ?? emptyBuffer();
  return {
    ...buffers,
    [path]: { ...current, ...patch },
  };
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  api: null,
  projectRoot: null,
  tabs: [],
  activePath: null,
  buffers: {},

  bindApi: (api) => set({ api }),

  setContentFromEditor: (content) => {
    const { activePath, buffers } = get();
    if (!activePath) {
      return;
    }
    const buffer = buffers[activePath];
    if (!buffer) {
      return;
    }
    set({
      buffers: patchBuffer(buffers, activePath, {
        content,
        dirty: content !== buffer.baselineContent,
      }),
    });
  },

  clearSaveError: (path) => {
    const target = path ?? get().activePath;
    if (!target) {
      return;
    }
    set((state) => ({
      buffers: patchBuffer(state.buffers, target, { saveError: null }),
    }));
  },

  saveTab: async (path) => {
    const { api, projectRoot, buffers } = get();
    const buffer = buffers[path];
    if (!api || !projectRoot || !buffer) {
      return false;
    }

    set((state) => ({
      buffers: patchBuffer(state.buffers, path, {
        status: "saving",
        saveError: null,
      }),
    }));

    try {
      await api.writeFile(projectRoot, path, buffer.content);
      set((state) => ({
        buffers: patchBuffer(state.buffers, path, {
          baselineContent: buffer.content,
          dirty: false,
          status: "ready",
          saveError: null,
        }),
      }));
      return true;
    } catch (error) {
      set((state) => ({
        buffers: patchBuffer(state.buffers, path, {
          saveError: toErrorMessage(error),
          status: "ready",
        }),
      }));
      return false;
    }
  },

  saveIfDirty: async () => {
    const { activePath, buffers } = get();
    if (!activePath) {
      return true;
    }
    const buffer = buffers[activePath];
    if (!buffer?.dirty) {
      return true;
    }
    return get().saveTab(activePath);
  },

  save: async () => {
    const { activePath } = get();
    if (!activePath) {
      return false;
    }
    return get().saveTab(activePath);
  },

  saveAllDirty: async () => {
    const { tabs, buffers } = get();
    for (const tab of tabs) {
      const buffer = buffers[tab.path];
      if (!buffer?.dirty) {
        continue;
      }
      const ok = await get().saveTab(tab.path);
      if (!ok) {
        set({ activePath: tab.path });
        return false;
      }
    }
    return true;
  },

  openFile: async (projectRoot, path) => {
    const state = get();
    const existingTab = state.tabs.find((t) => t.path === path);
    const existingBuffer = state.buffers[path];

    if (existingTab && existingBuffer?.status === "ready") {
      set({
        activePath: path,
        projectRoot,
        buffers: patchBuffer(state.buffers, path, { saveError: null }),
      });
      return true;
    }

    if (existingTab && existingBuffer?.status === "error") {
      set({ activePath: path, projectRoot });
      // fall through to reload
    } else if (!existingTab) {
      set({
        projectRoot,
        tabs: [...state.tabs, { path }],
        activePath: path,
        buffers: patchBuffer(state.buffers, path, {
          ...emptyBuffer(),
          status: "loading",
          errorMessage: null,
          saveError: null,
        }),
      });
    } else {
      set({
        projectRoot,
        activePath: path,
        buffers: patchBuffer(state.buffers, path, {
          status: "loading",
          errorMessage: null,
          saveError: null,
        }),
      });
    }

    const api = get().api;
    if (!api) {
      set((s) => ({
        buffers: patchBuffer(s.buffers, path, {
          content: "",
          baselineContent: "",
          dirty: false,
          status: "error",
          errorMessage: "Editor API not bound",
        }),
      }));
      return false;
    }

    try {
      const content = await api.readFile(projectRoot, path);
      set((s) => ({
        buffers: patchBuffer(s.buffers, path, {
          content,
          baselineContent: content,
          dirty: false,
          status: "ready",
          errorMessage: null,
          saveError: null,
        }),
      }));
      return true;
    } catch (error) {
      set((s) => ({
        buffers: patchBuffer(s.buffers, path, {
          content: "",
          baselineContent: "",
          dirty: false,
          status: "error",
          errorMessage: toErrorMessage(error),
        }),
      }));
      return false;
    }
  },

  setActivePath: (path) => {
    const { tabs } = get();
    if (!tabs.some((t) => t.path === path)) {
      return;
    }
    set({ activePath: path });
  },

  closeTab: (path) => {
    const { tabs, activePath, buffers } = get();
    const index = tabs.findIndex((t) => t.path === path);
    if (index === -1) {
      return;
    }

    const nextTabs = tabs.filter((t) => t.path !== path);
    const { [path]: _removed, ...nextBuffers } = buffers;

    let nextActivePath = activePath;
    if (activePath === path) {
      const rightNeighbor = tabs[index + 1]?.path;
      const leftNeighbor = tabs[index - 1]?.path;
      nextActivePath = rightNeighbor ?? leftNeighbor ?? null;
    }

    set({
      tabs: nextTabs,
      buffers: nextBuffers,
      activePath: nextActivePath,
    });
  },
}));
