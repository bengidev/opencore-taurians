import { create } from "zustand";
import type { EditorApi } from "../api/editorApi";
import { isUntitledId } from "./editorTabId";

export type EditorStatus = "idle" | "loading" | "ready" | "saving" | "error";

export interface EditorBuffer {
  content: string;
  baselineContent: string;
  dirty: boolean;
  status: EditorStatus;
  errorMessage: string | null;
  saveError: string | null;
  readOnly: boolean;
}

export interface EditorTab {
  id: string;
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
    readOnly: false,
  };
}

export interface EditorState {
  api: EditorApi | null;
  projectRoot: string | null;
  tabs: EditorTab[];
  activeTabId: string | null;
  buffers: Record<string, EditorBuffer>;
  nextUntitled: number;
  openBatchError: string | null;
  bindApi: (api: EditorApi) => void;
  clearOpenBatchError: () => void;
  setContentFromEditor: (content: string) => void;
  clearSaveError: (id?: string) => void;
  /** Active tab only. Path-backed only; Untitled → false without write. */
  saveIfDirty: () => Promise<boolean>;
  /** Active tab only. Path-backed only; Untitled → false without write. */
  save: () => Promise<boolean>;
  /** Save one tab by id (used by close→Save and quit). No-op false for Untitled. */
  saveTab: (id: string) => Promise<boolean>;
  /** Save all dirty path-backed tabs in open order. Returns false if any fail; activates first failure. */
  saveAllDirtyPaths: () => Promise<boolean>;
  /**
   * Append or focus. Never save-before-switch.
   * Already open + ready: focus, clear that buffer's saveError, do not reload.
   * Already open + error: focus and retry load.
   * New path: append tab, set activeTabId, load into buffer.
   */
  openFile: (projectRoot: string, path: string) => Promise<boolean>;
  /** Open multiple paths; classify under-root vs external read-only. */
  openPaths: (paths: string[]) => Promise<boolean>;
  openUntitled: () => string;
  /** Activate an already-open tab (no reload). */
  setActiveTabId: (id: string) => void;
  /**
   * Remove tab and buffer. If it was active, prefer right neighbor else left;
   * if none left, activeTabId = null.
   * Caller must only invoke when clean, after Don't save, or after successful Save.
   */
  closeTab: (id: string) => void;
  /**
   * createFile then retarget. If targetId already open as another tab, close it after successful create.
   * Returns false on failure (sets saveError on source).
   */
  saveAs: (sourceId: string, targetPath: string) => Promise<boolean>;
  dirtyUntitledIds: () => string[];
}

type EditorStore = EditorState;

function patchBuffer(
  buffers: Record<string, EditorBuffer>,
  id: string,
  patch: Partial<EditorBuffer>,
): Record<string, EditorBuffer> {
  const current = buffers[id] ?? emptyBuffer();
  return {
    ...buffers,
    [id]: { ...current, ...patch },
  };
}

type EditorStoreApi = {
  get: () => EditorStore;
  set: (
    partial:
      | Partial<EditorStore>
      | ((state: EditorStore) => Partial<EditorStore>),
  ) => void;
};

async function openExternalReadOnly(
  { get, set }: EditorStoreApi,
  path: string,
): Promise<void> {
  const state = get();
  const existingTab = state.tabs.find((t) => t.id === path);
  const existingBuffer = state.buffers[path];

  if (existingTab && existingBuffer?.status === "ready") {
    set({
      activeTabId: path,
      buffers: patchBuffer(state.buffers, path, { saveError: null }),
    });
    return;
  }

  if (existingTab && existingBuffer?.status === "error") {
    set({ activeTabId: path });
    // fall through to reload
  } else if (!existingTab) {
    set({
      tabs: [...state.tabs, { id: path }],
      activeTabId: path,
      buffers: patchBuffer(state.buffers, path, {
        ...emptyBuffer(),
        status: "loading",
        errorMessage: null,
        saveError: null,
        readOnly: true,
      }),
    });
  } else {
    set({
      activeTabId: path,
      buffers: patchBuffer(state.buffers, path, {
        status: "loading",
        errorMessage: null,
        saveError: null,
        readOnly: true,
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
        readOnly: true,
      }),
    }));
    return;
  }

  try {
    const content = await api.readExternalFile(path);
    set((s) => ({
      buffers: patchBuffer(s.buffers, path, {
        content,
        baselineContent: content,
        dirty: false,
        status: "ready",
        errorMessage: null,
        saveError: null,
        readOnly: true,
      }),
    }));
  } catch (error) {
    set((s) => ({
      buffers: patchBuffer(s.buffers, path, {
        content: "",
        baselineContent: "",
        dirty: false,
        status: "error",
        errorMessage: toErrorMessage(error),
        readOnly: true,
      }),
    }));
  }
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  api: null,
  projectRoot: null,
  tabs: [],
  activeTabId: null,
  buffers: {},
  nextUntitled: 1,
  openBatchError: null,

  bindApi: (api) => set({ api }),

  clearOpenBatchError: () => set({ openBatchError: null }),

  setContentFromEditor: (content) => {
    const { activeTabId, buffers } = get();
    if (!activeTabId) {
      return;
    }
    const buffer = buffers[activeTabId];
    if (!buffer || buffer.readOnly) {
      return;
    }
    set({
      buffers: patchBuffer(buffers, activeTabId, {
        content,
        dirty: content !== buffer.baselineContent,
      }),
    });
  },

  clearSaveError: (id) => {
    const target = id ?? get().activeTabId;
    if (!target) {
      return;
    }
    set((state) => ({
      buffers: patchBuffer(state.buffers, target, { saveError: null }),
    }));
  },

  saveTab: async (id) => {
    if (isUntitledId(id)) {
      return false;
    }

    const { api, projectRoot, buffers } = get();
    const buffer = buffers[id];
    if (!api || !projectRoot || !buffer) {
      return false;
    }
    if (buffer.readOnly) {
      return false;
    }

    set((state) => ({
      buffers: patchBuffer(state.buffers, id, {
        status: "saving",
        saveError: null,
      }),
    }));

    try {
      await api.writeFile(projectRoot, id, buffer.content);
      set((state) => ({
        buffers: patchBuffer(state.buffers, id, {
          baselineContent: buffer.content,
          dirty: false,
          status: "ready",
          saveError: null,
        }),
      }));
      return true;
    } catch (error) {
      set((state) => ({
        buffers: patchBuffer(state.buffers, id, {
          saveError: toErrorMessage(error),
          status: "ready",
        }),
      }));
      return false;
    }
  },

  saveIfDirty: async () => {
    const { activeTabId, buffers } = get();
    if (!activeTabId) {
      return true;
    }
    if (isUntitledId(activeTabId)) {
      const buffer = buffers[activeTabId];
      if (!buffer?.dirty) {
        return true;
      }
      return false;
    }
    const buffer = buffers[activeTabId];
    if (!buffer?.dirty) {
      return true;
    }
    if (buffer.readOnly) {
      return false;
    }
    return get().saveTab(activeTabId);
  },

  save: async () => {
    const { activeTabId } = get();
    if (!activeTabId) {
      return true;
    }
    if (isUntitledId(activeTabId)) {
      return false;
    }
    const buffer = get().buffers[activeTabId];
    if (buffer?.readOnly) {
      return false;
    }
    return get().saveTab(activeTabId);
  },

  saveAllDirtyPaths: async () => {
    const { tabs, buffers } = get();
    for (const tab of tabs) {
      if (isUntitledId(tab.id)) {
        continue;
      }
      const buffer = buffers[tab.id];
      if (!buffer?.dirty) {
        continue;
      }
      const ok = await get().saveTab(tab.id);
      if (!ok) {
        set({ activeTabId: tab.id });
        return false;
      }
    }
    return true;
  },

  openFile: async (projectRoot, path) => {
    const state = get();
    const existingTab = state.tabs.find((t) => t.id === path);
    const existingBuffer = state.buffers[path];

    if (existingTab && existingBuffer?.status === "ready") {
      set({
        activeTabId: path,
        projectRoot,
        buffers: patchBuffer(state.buffers, path, { saveError: null, readOnly: false }),
      });
      return true;
    }

    if (existingTab && existingBuffer?.status === "error") {
      set({ activeTabId: path, projectRoot });
      // fall through to reload
    } else if (!existingTab) {
      set({
        projectRoot,
        tabs: [...state.tabs, { id: path }],
        activeTabId: path,
        buffers: patchBuffer(state.buffers, path, {
          ...emptyBuffer(),
          status: "loading",
          errorMessage: null,
          saveError: null,
          readOnly: false,
        }),
      });
    } else {
      set({
        projectRoot,
        activeTabId: path,
        buffers: patchBuffer(state.buffers, path, {
          status: "loading",
          errorMessage: null,
          saveError: null,
          readOnly: false,
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
          readOnly: false,
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
          readOnly: false,
        }),
      }));
      return false;
    }
  },

  openUntitled: () => {
    const n = get().nextUntitled;
    const id = `untitled:${n}`;
    const { tabs, buffers } = get();
    set({
      nextUntitled: n + 1,
      tabs: [...tabs, { id }],
      activeTabId: id,
      buffers: {
        ...buffers,
        [id]: {
          content: "",
          baselineContent: "",
          dirty: false,
          status: "ready",
          errorMessage: null,
          saveError: null,
          readOnly: false,
        },
      },
    });
    return id;
  },

  openPaths: async (paths) => {
    const { api, projectRoot } = get();
    if (!projectRoot) {
      set({ openBatchError: "Open a project first" });
      return false;
    }
    if (!api) {
      set({ openBatchError: "Editor API not bound" });
      return false;
    }
    if (paths.length === 0) {
      return true;
    }

    const hasDir = await api.pathsIncludeDirectory(paths);
    if (hasDir) {
      set({ openBatchError: "Folders can't be opened here" });
      return false;
    }

    set({ openBatchError: null });

    let lastId: string | null = null;
    for (const path of paths) {
      const under = await api.isUnderRoot(projectRoot, path);
      if (under) {
        await get().openFile(projectRoot, path);
        set((s) => ({
          buffers: patchBuffer(s.buffers, path, { readOnly: false }),
        }));
      } else {
        await openExternalReadOnly({ get, set }, path);
      }
      lastId = path;
    }
    if (lastId) {
      set({ activeTabId: lastId });
    }
    return true;
  },

  setActiveTabId: (id) => {
    const { tabs } = get();
    if (!tabs.some((t) => t.id === id)) {
      return;
    }
    set({ activeTabId: id });
  },

  closeTab: (id) => {
    const { tabs, activeTabId, buffers } = get();
    const index = tabs.findIndex((t) => t.id === id);
    if (index === -1) {
      return;
    }

    const nextTabs = tabs.filter((t) => t.id !== id);
    const { [id]: _removed, ...nextBuffers } = buffers;

    let nextActiveTabId = activeTabId;
    if (activeTabId === id) {
      const rightNeighbor = tabs[index + 1]?.id;
      const leftNeighbor = tabs[index - 1]?.id;
      nextActiveTabId = rightNeighbor ?? leftNeighbor ?? null;
    }

    set({
      tabs: nextTabs,
      buffers: nextBuffers,
      activeTabId: nextActiveTabId,
    });
  },

  saveAs: async (sourceId, targetPath) => {
    const { api, projectRoot, buffers } = get();
    const buffer = buffers[sourceId];
    if (!api || !projectRoot || !buffer) return false;
    if (buffer.readOnly) {
      return false;
    }
    set({
      buffers: patchBuffer(buffers, sourceId, { status: "saving", saveError: null }),
    });
    try {
      await api.createFile(projectRoot, targetPath, buffer.content);
    } catch (error) {
      set((s) => ({
        buffers: patchBuffer(s.buffers, sourceId, {
          status: "ready",
          saveError: toErrorMessage(error),
        }),
      }));
      return false;
    }

    const collision = get().tabs.find((t) => t.id === targetPath && t.id !== sourceId);
    if (collision) {
      get().closeTab(targetPath);
    }

    const state = get();
    const buf = state.buffers[sourceId];
    if (!buf) return false;
    const { [sourceId]: _removed, ...rest } = state.buffers;
    const nextTabs = state.tabs.map((t) =>
      t.id === sourceId ? { id: targetPath } : t,
    );
    const deduped: EditorTab[] = [];
    for (const t of nextTabs) {
      if (!deduped.some((x) => x.id === t.id)) deduped.push(t);
    }
    set({
      tabs: deduped,
      activeTabId: state.activeTabId === sourceId ? targetPath : state.activeTabId,
      buffers: {
        ...rest,
        [targetPath]: {
          ...buf,
          baselineContent: buf.content,
          dirty: false,
          status: "ready",
          saveError: null,
        },
      },
    });
    return true;
  },

  dirtyUntitledIds: () => {
    const { tabs, buffers } = get();
    return tabs
      .filter((t) => isUntitledId(t.id) && buffers[t.id]?.dirty)
      .map((t) => t.id);
  },
}));
