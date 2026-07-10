import { getSessionStateStorage } from "../infrastructure/sessionPersistStorage";
import { useSessionStore } from "./sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useShellStore } from "../../shell/state/shellStore";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { THEME_STORAGE_KEY } from "../../onboarding/infrastructure/onboardingThemeConstants";

async function flushPersistWrites(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function resetAllPersistedSession(): Promise<void> {
  localStorage.removeItem(THEME_STORAGE_KEY);
  useSessionStore.getState().resetSessionFlags();
  useWorkspaceStore.getState().clearWorkspace();
  useShellStore.getState().resetShellUi();
  useThemeStore.getState().resetTheme();

  const storage = getSessionStateStorage();
  await storage.clearAll();
  await flushPersistWrites();
  await storage.clearAll();
}
