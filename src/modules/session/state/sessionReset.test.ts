import { beforeEach, describe, expect, it } from "vitest";
import {
  useMemoryPersistStorage,
  getSessionStateStorage,
} from "../infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../infrastructure/sessionPersistKeys";
import { GUI_SCALE_DEFAULT } from "../domain/sessionGuiScale";
import { useSessionStore } from "./sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useShellStore } from "../../shell/state/shellStore";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { THEME_STORAGE_KEY } from "../../onboarding/infrastructure/onboardingThemeConstants";
import { useChatStore } from "../../chat/state/chatStore";
import { useProjectStore } from "../../project/state/projectStore";
import { resetAllPersistedSession } from "./sessionReset";

describe("resetAllPersistedSession", () => {
  beforeEach(async () => {
    useMemoryPersistStorage();
    useSessionStore.getState().completeOnboarding();
    useSessionStore.getState().setGuiScale(1.5);
    useWorkspaceStore.getState().setWorkspace("/tmp/x");
    useShellStore.getState().setActiveMainCard("editor");
    useShellStore.setState({ leftVisible: false, rightVisible: false });
    useThemeStore.getState().setMode("light");
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/tmp/x",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      trunkId: useProjectStore.getState().activeTrunkId!,
      role: "user",
      content: "x",
      createdAt: "2026-07-10T00:00:00.000Z",
    });
    await Promise.resolve();
  });

  it("clears stores, storage keys, and theme localStorage", async () => {
    await expect(
      getSessionStateStorage().getItem(SESSION_PERSIST_KEYS.session),
    ).resolves.not.toBeNull();

    await resetAllPersistedSession();
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
    expect(useSessionStore.getState().guiScale).toBe(GUI_SCALE_DEFAULT);
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
    expect(useShellStore.getState().activeMainCard).toBe("chat");
    expect(useShellStore.getState().leftVisible).toBe(true);
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    const storage = getSessionStateStorage();
    for (const key of Object.values(SESSION_PERSIST_KEYS)) {
      await expect(storage.getItem(key)).resolves.toBeNull();
    }
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useChatStore.getState().messagesByTrunkId).toEqual({});
  });
});
