import {
  createJSONStorage,
  type PersistStorage,
  type StateStorage,
} from "zustand/middleware";
import {
  createMemoryStateStorage,
  createTauriStateStorage,
  type SessionStateStorage,
} from "./sessionStateStorage";
import { SESSION_TAURI_STORE_FILE } from "./sessionPersistKeys";

let activeStorage: SessionStateStorage = createMemoryStateStorage();

const delegatingStorage: StateStorage = {
  getItem: (name) => activeStorage.getItem(name),
  setItem: (name, value) => activeStorage.setItem(name, value),
  removeItem: (name) => activeStorage.removeItem(name),
};

/** Test / boot override. Production boot calls `useTauriPersistStorage()`. */
export function setSessionStateStorage(storage: SessionStateStorage): void {
  activeStorage = storage;
}

export function getSessionStateStorage(): SessionStateStorage {
  return activeStorage;
}

export function createSessionPersistStorage<T>(): PersistStorage<T> | undefined {
  return createJSONStorage(() => delegatingStorage);
}

export async function useTauriPersistStorage(): Promise<SessionStateStorage> {
  const { Store } = await import("@tauri-apps/plugin-store");
  const storage = createTauriStateStorage(() => Store.load(SESSION_TAURI_STORE_FILE));
  setSessionStateStorage(storage);
  return storage;
}

export function useMemoryPersistStorage(
  initial?: Record<string, string>,
): SessionStateStorage {
  const storage = createMemoryStateStorage(initial);
  setSessionStateStorage(storage);
  return storage;
}
