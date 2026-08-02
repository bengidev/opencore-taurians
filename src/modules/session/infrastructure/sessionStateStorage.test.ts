import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryStateStorage,
  createTauriStateStorage,
  SESSION_PERSIST_KEYS,
} from "./sessionStateStorage";

beforeEach(() => {
  vi.useRealTimers();
});

describe("createMemoryStateStorage", () => {
  it("round-trips string values by key", async () => {
    const storage = createMemoryStateStorage();
    await storage.setItem(SESSION_PERSIST_KEYS.session, '{"state":{"onboardingCompleted":true}}');
    await expect(storage.getItem(SESSION_PERSIST_KEYS.session)).resolves.toContain(
      "onboardingCompleted",
    );
  });

  it("removes keys", async () => {
    const storage = createMemoryStateStorage();
    await storage.setItem(SESSION_PERSIST_KEYS.workspace, "x");
    await storage.removeItem(SESSION_PERSIST_KEYS.workspace);
    await expect(storage.getItem(SESSION_PERSIST_KEYS.workspace)).resolves.toBeNull();
  });

  it("clearAll removes every known persist key", async () => {
    const storage = createMemoryStateStorage();
    for (const key of Object.values(SESSION_PERSIST_KEYS)) {
      await storage.setItem(key, "1");
    }
    await storage.clearAll();
    for (const key of Object.values(SESSION_PERSIST_KEYS)) {
      await expect(storage.getItem(key)).resolves.toBeNull();
    }
  });
});

describe("createTauriStateStorage", () => {
  function createFakeStore() {
    const values = new Map<string, unknown>();
    const calls = { set: 0, save: 0, del: 0 };
    const loadStore = vi.fn(async () => ({
      get: async (key: string) => values.get(key) ?? null,
      set: async (key: string, value: unknown) => {
        calls.set++;
        values.set(key, value);
      },
      delete: async (key: string) => {
        calls.del++;
        values.delete(key);
      },
      save: async () => {
        calls.save++;
      },
    }));
    return { loadStore, values, calls };
  }

  it("coalesces rapid setItem calls into a single set+save", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { loadStore, calls } = createFakeStore();
    const storage = createTauriStateStorage(loadStore);

    await storage.setItem("a", "1");
    await storage.setItem("a", "2");
    await storage.setItem("a", "3");

    expect(calls.set).toBe(0);
    expect(calls.save).toBe(0);

    await vi.advanceTimersByTimeAsync(300);

    expect(calls.set).toBe(1);
    expect(calls.save).toBe(1);
  });

  it("flushes pending setItem immediately on removeItem", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { loadStore, calls, values } = createFakeStore();
    const storage = createTauriStateStorage(loadStore);

    await storage.setItem("a", "1");
    expect(calls.set).toBe(0);

    await storage.removeItem("a");

    expect(calls.set).toBe(0);
    expect(calls.del).toBe(1);
    expect(calls.save).toBe(1);
    expect(values.has("a")).toBe(false);
  });

  it("flushes pending setItem immediately on clearAll", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { loadStore, calls } = createFakeStore();
    const storage = createTauriStateStorage(loadStore);

    await storage.setItem("a", "1");
    expect(calls.set).toBe(0);

    await storage.clearAll();

    expect(calls.set).toBe(0);
    expect(calls.save).toBe(1);
  });

  it("writes each distinct key in its own flush window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { loadStore, calls } = createFakeStore();
    const storage = createTauriStateStorage(loadStore);

    await storage.setItem("a", "1");
    await vi.advanceTimersByTimeAsync(300);
    await storage.setItem("b", "2");
    await vi.advanceTimersByTimeAsync(300);

    expect(calls.set).toBe(2);
    expect(calls.save).toBe(2);
  });

  it("coalesces writes for different keys in the same flush window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { loadStore, calls, values } = createFakeStore();
    const storage = createTauriStateStorage(loadStore);

    await storage.setItem("a", "1");
    await storage.setItem("b", "2");
    await storage.setItem("a", "3");

    expect(calls.set).toBe(0);
    expect(calls.save).toBe(0);

    await vi.advanceTimersByTimeAsync(300);

    expect(calls.set).toBe(2);
    expect(calls.save).toBe(1);
    expect(values.get("a")).toBe("3");
    expect(values.get("b")).toBe("2");
  });
});
