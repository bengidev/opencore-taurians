import { useEffect } from "react";
import { OnboardingScreen } from "../../onboarding";
import { ShellScreen } from "../../shell";
import { WorkspacePopup } from "../../workspace-popup";
import type { FolderPicker } from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useTauriPersistStorage } from "../infrastructure/sessionPersistStorage";
import {
  createTauriWindowController,
  type WindowController,
} from "../infrastructure/sessionWindowController";
import { resetAllPersistedSession } from "../state/sessionReset";
import { useSessionStore } from "../state/sessionStore";
import { SessionDebugResetButton } from "./sessionDebugResetButton";

export interface SessionRootProps {
  windowController?: WindowController;
  folderPicker?: FolderPicker;
  /** When true, skip Tauri persist boot (tests set hasHydrated manually). */
  skipPersistBoot?: boolean;
}

export function SessionRoot({
  windowController = createTauriWindowController(),
  folderPicker,
  skipPersistBoot = false,
}: SessionRootProps = {}) {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const onboardingCompleted = useSessionStore((s) => s.onboardingCompleted);
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);

  useEffect(() => {
    if (skipPersistBoot) return;

    let cancelled = false;

    void (async () => {
      await useTauriPersistStorage();
      await useSessionStore.persist.rehydrate();
      if (cancelled) return;
      await useWorkspaceStore.persist.rehydrate();
    })();

    return () => {
      cancelled = true;
    };
  }, [skipPersistBoot]);

  useEffect(() => {
    if (!hasHydrated || onboardingCompleted) return;
    void windowController.applyOnboardingSize();
  }, [hasHydrated, onboardingCompleted, windowController]);

  const handleEnter = () => {
    completeOnboarding();
    void windowController.applyShellSize();
  };

  const handleReset = async () => {
    await resetAllPersistedSession();
    await windowController.applyOnboardingSize();
  };

  if (!hasHydrated) {
    return (
      <p className="flex min-h-dvh items-center justify-center font-mono text-sm uppercase tracking-[0.08em] text-muted-foreground">
        [LOADING...]
      </p>
    );
  }

  return (
    <>
      {!onboardingCompleted ? (
        <OnboardingScreen onEnter={handleEnter} />
      ) : (
        <>
          <ShellScreen />
          {!workspacePath ? (
            <WorkspacePopup folderPicker={folderPicker} />
          ) : null}
        </>
      )}
      <SessionDebugResetButton onReset={handleReset} />
    </>
  );
}
