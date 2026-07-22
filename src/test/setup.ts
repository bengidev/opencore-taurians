import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { createMemoryEditorApi } from "../modules/editor/api/createMemoryEditorApi";
import { createMemoryExplorerApi } from "../modules/explorer/api/createMemoryExplorerApi";

vi.mock("../modules/editor/api/editorApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/editor/api/editorApi")>();
  return {
    ...actual,
    createTauriEditorApi: () => createMemoryEditorApi(),
  };
});

vi.mock("../modules/explorer/api/explorerApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/explorer/api/explorerApi")>();
  return {
    ...actual,
    createTauriExplorerApi: () => createMemoryExplorerApi(),
  };
});

// EditorDropZone / useEditorOsFileDrop call Tauri listen on mount. Shell and
// settings tests mount those without a file-local mock; real listen needs IPC.
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  storage.clear();
});
