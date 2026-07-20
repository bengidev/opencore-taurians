import { useEffect, useState } from "react";
import { OnboardingScreen } from "../../onboarding";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { ShellScreen } from "../../shell";
import { useShellStore } from "../../shell/state/shellStore";
import { WorkspacePopup } from "../../workspace-popup";
import type { FolderPicker } from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useChatStore } from "../../chat";
import {
  projectBootMigrateAndSweep,
  projectSyncRestoreFromShell,
  useProjectStore,
} from "../../project";
import { useTauriPersistStorage } from "../infrastructure/sessionPersistStorage";
import { readLogicalWorkArea } from "../infrastructure/sessionWorkArea";
import {
  ONBOARDING_WINDOW_SIZE,
  SHELL_WINDOW_SIZE,
  createTauriWindowController,
  type WindowController,
} from "../infrastructure/sessionWindowController";
import { guiScaleAfterWorkAreaClamp } from "../domain/sessionGuiScale";
import { resetAllPersistedSession } from "../state/sessionReset";
import { useSessionStore } from "../state/sessionStore";
import { SessionDebugResetButton } from "./sessionDebugResetButton";
import "./sessionScreenTransition.css";
import { useSessionScreenTransition } from "./useSessionScreenTransition";

export interface SessionRootProps {
  windowController?: WindowController;
  folderPicker?: FolderPicker;
  /** When true, skip Tauri persist boot (tests set hasHydrated manually). */
  skipPersistBoot?: boolean;
}

const defaultWindowController = createTauriWindowController();

export function SessionRoot({
  windowController = defaultWindowController,
  folderPicker,
  skipPersistBoot = false,
}: SessionRootProps = {}) {
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const [persistReady, setPersistReady] = useState(skipPersistBoot);
  const [workspacePopupOpen, setWorkspacePopupOpen] = useState(true);
  const onboardingCompleted = useSessionStore((s) => s.onboardingCompleted);
  const guiScale = useSessionStore((s) => s.guiScale);
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);

  const commitOnboarding = () => {
    completeOnboarding();
    setWorkspacePopupOpen(true);
  };

  const {
    abortEnterTransition,
    beginEnter,
    showOnboarding,
    showShell,
    isTransitioning,
    onboardingExiting,
    shellVisible,
    shellInstant,
  } = useSessionScreenTransition({
    onboardingCompleted,
    onCommitOnboarding: commitOnboarding,
  });

  useEffect(() => {
    if (skipPersistBoot) return;

    let cancelled = false;

    void (async () => {
      try {
        await useTauriPersistStorage();
        await Promise.all([
          useSessionStore.persist.rehydrate(),
          useWorkspaceStore.persist.rehydrate(),
          useShellStore.persist.rehydrate(),
          useThemeStore.persist.rehydrate(),
          useProjectStore.persist.rehydrate(),
          useChatStore.persist.rehydrate(),
        ]);
      } catch {
        useSessionStore.getState().setHasHydrated(true);
      }
      if (!cancelled) {
        setPersistReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [skipPersistBoot]);

  const ready = hasHydrated && persistReady;

  useEffect(() => {
    if (!ready) return;
    projectBootMigrateAndSweep({
      workspacePath: useWorkspaceStore.getState().workspacePath,
      nowIso: new Date().toISOString(),
      nowMs: Date.now(),
    });
  }, [ready]);

  useEffect(() => {
    return useShellStore.subscribe((state, prev) => {
      if (state.activeMainCard !== prev.activeMainCard) {
        projectSyncRestoreFromShell();
      }
    });
  }, []);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    void (async () => {
      const area = await readLogicalWorkArea();
      if (cancelled) return;
      const base =
        isTransitioning || (onboardingCompleted && showShell)
          ? SHELL_WINDOW_SIZE
          : ONBOARDING_WINDOW_SIZE;
      const current = useSessionStore.getState().guiScale;
      const clamped = guiScaleAfterWorkAreaClamp(current, base, area);
      if (clamped !== current) useSessionStore.getState().setGuiScale(clamped);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, isTransitioning, onboardingCompleted, showShell]);

  useEffect(() => {
    if (!ready) return;
    if (isTransitioning || (onboardingCompleted && showShell)) {
      void windowController.applyShellSize(guiScale);
    } else {
      void windowController.applyOnboardingSize(guiScale);
    }
  }, [
    ready,
    isTransitioning,
    onboardingCompleted,
    showShell,
    windowController,
    guiScale,
  ]);

  const handleEnter = (options?: { instant?: boolean }) => {
    beginEnter(options);
  };

  const handleReset = async () => {
    abortEnterTransition();
    await resetAllPersistedSession();
    setWorkspacePopupOpen(true);
  };

  if (!ready) {
    return (
      <>
        <p className="flex min-h-dvh items-center justify-center font-mono text-sm uppercase tracking-[0.08em] text-muted-foreground">
          [LOADING...]
        </p>
        <SessionDebugResetButton onReset={handleReset} />
      </>
    );
  }

  return (
    <div
      className="session-screen-transition relative min-h-dvh overflow-hidden"
      data-transitioning={isTransitioning ? "true" : "false"}
      data-gui-scale={String(guiScale)}
      style={{ zoom: guiScale } as React.CSSProperties}
    >
      {showShell ? (
        <div
          className="session-shell-layer min-h-dvh"
          data-visible={shellVisible ? "true" : "false"}
          data-instant={shellInstant ? "true" : "false"}
        >
          <ShellScreen />
          {onboardingCompleted &&
          !isTransitioning &&
          !workspacePath &&
          workspacePopupOpen ? (
            <WorkspacePopup
              folderPicker={folderPicker}
              onClose={() => setWorkspacePopupOpen(false)}
            />
          ) : null}
        </div>
      ) : null}
      {showOnboarding ? (
        <div
          className="session-onboarding-layer absolute inset-0 z-10"
          data-exiting={onboardingExiting ? "true" : "false"}
        >
          <OnboardingScreen onEnter={handleEnter} />
        </div>
      ) : null}
      <SessionDebugResetButton onReset={handleReset} />
    </div>
  );
}
