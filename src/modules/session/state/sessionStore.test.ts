import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../infrastructure/sessionPersistStorage";
import { useSessionStore } from "./sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useSessionStore.setState({
      onboardingCompleted: false,
      hasHydrated: true,
    });
  });

  it("starts with onboarding incomplete", () => {
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
  });

  it("completeOnboarding sets the flag", () => {
    useSessionStore.getState().completeOnboarding();
    expect(useSessionStore.getState().onboardingCompleted).toBe(true);
  });

  it("resetSessionFlags clears onboardingCompleted", () => {
    useSessionStore.getState().completeOnboarding();
    useSessionStore.getState().resetSessionFlags();
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
  });
});
