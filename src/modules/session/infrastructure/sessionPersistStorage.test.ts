import { beforeEach, describe, expect, it } from "vitest";
import {
  getSessionStateStorage,
  useMemoryPersistStorage,
} from "./sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "./sessionPersistKeys";
import { useSessionStore } from "../state/sessionStore";

describe("sessionPersistStorage", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
  });

  it("routes store writes through the active storage backend", async () => {
    useSessionStore.getState().completeOnboarding();
    await Promise.resolve();

    await expect(
      getSessionStateStorage().getItem(SESSION_PERSIST_KEYS.session),
    ).resolves.toContain("onboardingCompleted");
  });
});
