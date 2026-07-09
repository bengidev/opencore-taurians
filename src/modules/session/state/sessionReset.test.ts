import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage, getSessionStateStorage } from "../infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../infrastructure/sessionPersistKeys";
import { useSessionStore } from "./sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useShellStore } from "../../shell/state/shellStore";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { THEME_STORAGE_KEY } from "../../onboarding/infrastructure/onboardingThemeConstants";
import { resetAllPersistedSession } from "./sessionReset";

describe("resetAllPersistedSession", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useSessionStore.setState({ onboardingCompleted: true });
    useWorkspaceStore.setState({ workspacePath: "/tmp/x" });
    useShellStore.setState({
      activeMainCard: "editor",
      leftVisible: false,
      rightVisible: false,
    });
    useThemeStore.getState().setMode("light");
  });

  it("clears stores, storage keys, and theme localStorage", async () => {
    await resetAllPersistedSession();
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
    expect(useShellStore.getState().activeMainCard).toBe("chat");
    expect(useShellStore.getState().leftVisible).toBe(true);
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    const storage = getSessionStateStorage();
    for (const key of Object.values(SESSION_PERSIST_KEYS)) {
      await expect(storage.getItem(key)).resolves.toBeNull();
    }
  });
});
