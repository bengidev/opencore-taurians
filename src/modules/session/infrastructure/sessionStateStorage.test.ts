import { describe, expect, it } from "vitest";
import {
  createMemoryStateStorage,
  SESSION_PERSIST_KEYS,
} from "./sessionStateStorage";

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
