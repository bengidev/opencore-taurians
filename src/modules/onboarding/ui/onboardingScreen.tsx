import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GalaxyOrbCanvas } from "./onboardingGalaxyOrbCanvas";
import { SceneBackdrop } from "./onboardingSceneBackdrop";
import { useTheme } from "./onboardingThemeContext";
import { ThemeToggle } from "./onboardingThemeToggle";

export interface OnboardingScreenProps {
  onEnter?: (options?: { instant?: boolean }) => void;
}

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.closest("button, input, textarea, select, a[href], [role='button']") !==
    null
  );
}

export function OnboardingScreen({ onEnter }: OnboardingScreenProps) {
  const { mode } = useTheme();
  const [themePulse, setThemePulse] = useState(false);
  const [ready, setReady] = useState(false);
  const themeMountedRef = useRef(false);

  const handleEnter = useCallback(
    (instant = false) => {
      onEnter?.({ instant });
    },
    [onEnter],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.isComposing) return;
      if (event.metaKey || event.ctrlKey) return;
      if (isInteractiveKeyboardTarget(event.target)) return;

      // Keyboard-driven enter stays instant — no animation.
      handleEnter(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleEnter]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!themeMountedRef.current) {
      themeMountedRef.current = true;
      return;
    }

    setThemePulse(true);
    const timer = window.setTimeout(() => setThemePulse(false), 280);
    return () => window.clearTimeout(timer);
  }, [mode]);

  return (
    <div
      className={`onboarding-screen relative h-full min-h-full overflow-hidden bg-background text-foreground${
        themePulse ? " onboarding-theme-pulse" : ""
      }`}
      data-theme-mode={mode}
      data-ready={ready ? "true" : "false"}
    >
      <SceneBackdrop />
      <div
        className="onboarding-theme-flash"
        aria-hidden="true"
        data-active={themePulse ? "true" : "false"}
      />

      <div className="relative z-1 mx-auto grid h-full min-h-full w-full max-w-[960px] grid-rows-[auto_1fr_auto] px-8 py-7 md:px-12 md:py-9">
        <header className="onboarding-enter onboarding-enter-1 flex items-start justify-between gap-8">
          <div className="flex flex-col gap-1.5">
            <span className="onboarding-brand text-[2.5rem] leading-none tracking-[-0.03em]">
              OpenCore
            </span>
            <span className="onboarding-label">Local AI Workspace</span>
          </div>
          <ThemeToggle />
        </header>

        <section
          className="grid items-center gap-10 py-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-14 md:py-12"
          aria-labelledby="onboarding-headline"
        >
          <div className="onboarding-enter onboarding-enter-2 h-[260px] w-full max-w-[480px] justify-self-start md:h-[300px]">
            <GalaxyOrbCanvas />
          </div>

          <div className="onboarding-enter onboarding-enter-3 flex max-w-lg flex-col gap-5 justify-self-start md:pt-2">
            <h1
              id="onboarding-headline"
              className="onboarding-brand text-[clamp(1.5rem,2.5vw,1.875rem)] leading-[1.15] tracking-[-0.02em] text-balance"
            >
              Your local AI command workspace
            </h1>

            <p className="onboarding-label-copy max-w-[44ch] text-pretty">
              OpenCore combines chat, terminal, editing, and Rust-native performance
              in one permissioned desktop environment. To leave the crowded cloud,
              polluted by leaks and unconsciousness, to return to a workspace that
              stays on your machine.
            </p>
          </div>
        </section>

        <footer className="onboarding-enter onboarding-enter-4 flex items-center justify-between gap-6 border-t border-[color:var(--ds-border)] pt-6">
          <span className="onboarding-label">Press Enter</span>
          <Button
            type="button"
            size="lg"
            className="onboarding-cta h-9 min-h-9 px-6 font-normal"
            onClick={() => handleEnter()}
          >
            Enter OpenCore
          </Button>
        </footer>
      </div>
    </div>
  );
}
