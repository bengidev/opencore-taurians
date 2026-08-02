import type { StateStorage } from "zustand/middleware";
import { SESSION_PERSIST_KEYS, type SessionPersistKey } from "./sessionPersistKeys";

export { SESSION_PERSIST_KEYS, SESSION_TAURI_STORE_FILE } from "./sessionPersistKeys";
export type { SessionPersistKey } from "./sessionPersistKeys";

/** Milliseconds to wait before flushing coalesced Tauri store writes. */
const TAURI_STORE_WRITE_DEBOUNCE_MS = 250;

export interface SessionStateStorage extends StateStorage {
  clearAll(): Promise<void>;
}

export function createMemoryStateStorage(
  initial?: Record<string, string>,
): SessionStateStorage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));

  return {
    getItem: async (name) => map.get(name) ?? null,
    setItem: async (name, value) => {
      map.set(name, value);
    },
    removeItem: async (name) => {
      map.delete(name);
    },
    clearAll: async () => {
      for (const key of Object.values(SESSION_PERSIST_KEYS)) {
        map.delete(key);
      }
    },
  };
}

/** Production adapter — uses Tauri Store under the hood. */
export function createTauriStateStorage(
  loadStore: () => Promise<{
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void | boolean>;
    save: () => Promise<void>;
  }>,
): SessionStateStorage {
  let storePromise: ReturnType<typeof loadStore> | null = null;
  const store = () => {
    storePromise ??= loadStore();
    return storePromise;
  };

  const pendingSets = new Map<string, string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = async (): Promise<void> => {
    flushTimer = null;
    if (pendingSets.size === 0) return;
    const s = await store();
    for (const [name, value] of pendingSets) {
      await s.set(name, value);
    }
    pendingSets.clear();
    await s.save();
  };

  const scheduleFlush = (): void => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      void flush();
    }, TAURI_STORE_WRITE_DEBOUNCE_MS);
  };

  return {
    getItem: async (name) => {
      const value = await (await store()).get(name);
      return typeof value === "string" ? value : value == null ? null : JSON.stringify(value);
    },
    setItem: async (name, value) => {
      pendingSets.set(name, value);
      scheduleFlush();
    },
    removeItem: async (name) => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      pendingSets.delete(name);
      const s = await store();
      await s.delete(name);
      await s.save();
    },
    clearAll: async () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      pendingSets.clear();
      const s = await store();
      for (const key of Object.values(SESSION_PERSIST_KEYS) as SessionPersistKey[]) {
        await s.delete(key);
      }
      await s.save();
    },
  };
}
