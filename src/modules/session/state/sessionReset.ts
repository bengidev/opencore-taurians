import { getSessionStateStorage } from "../infrastructure/sessionPersistStorage";
import { useSessionStore } from "./sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useShellStore } from "../../shell/state/shellStore";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { THEME_STORAGE_KEY } from "../../onboarding/infrastructure/onboardingThemeConstants";

export async function resetAllPersistedSession(): Promise<void> {
  await getSessionStateStorage().clearAll();
  localStorage.removeItem(THEME_STORAGE_KEY);
  useSessionStore.getState().resetSessionFlags();
  useWorkspaceStore.getState().clearWorkspace();
  useShellStore.getState().resetShellUi();
  useThemeStore.getState().resetTheme();
}
