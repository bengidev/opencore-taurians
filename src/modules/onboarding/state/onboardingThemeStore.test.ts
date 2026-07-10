import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { THEME_STORAGE_KEY } from "../infrastructure/onboardingThemeConstants";
import { useThemeStore } from "./onboardingThemeStore";

describe("onboardingThemeStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    localStorage.clear();
    useThemeStore.setState({ mode: "dark" });
  });

  it("toggle switches light and dark", () => {
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe("light");
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe("dark");
  });

  it("mirrors mode to localStorage for theme-boot", () => {
    useThemeStore.getState().setMode("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
