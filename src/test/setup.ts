import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import { createMemoryExplorerApi } from "../modules/explorer/api/createMemoryExplorerApi";

vi.mock("../modules/explorer/api/explorerApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/explorer/api/explorerApi")>();
  return {
    ...actual,
    createTauriExplorerApi: () => createMemoryExplorerApi(),
  };
});

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
