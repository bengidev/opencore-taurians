import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../infrastructure/sessionPersistStorage";
import { GUI_SCALE_DEFAULT } from "../domain/sessionGuiScale";
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

describe("sessionStore guiScale", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useSessionStore.setState({
      onboardingCompleted: false,
      hasHydrated: true,
      guiScale: GUI_SCALE_DEFAULT,
    });
  });

  it("defaults to 100% and clamps on set", () => {
    expect(useSessionStore.getState().guiScale).toBe(1);
    useSessionStore.getState().setGuiScale(2.5);
    expect(useSessionStore.getState().guiScale).toBe(2);
    useSessionStore.getState().setGuiScale(0.25);
    expect(useSessionStore.getState().guiScale).toBe(0.5);
  });

  it("resetSessionFlags restores default scale", () => {
    useSessionStore.getState().setGuiScale(1.5);
    useSessionStore.getState().resetSessionFlags();
    expect(useSessionStore.getState().guiScale).toBe(1);
  });
});
