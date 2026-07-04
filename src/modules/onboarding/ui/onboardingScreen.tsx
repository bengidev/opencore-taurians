import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GalaxyOrbCanvas } from "./onboardingGalaxyOrbCanvas";
import { SceneBackdrop } from "./onboardingSceneBackdrop";
import { ThemeToggle } from "./onboardingThemeToggle";

export interface OnboardingScreenProps {
  onEnter?: () => void;
}

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.closest("button, input, textarea, select, a[href], [role='button']") !==
    null
  );
}

export function OnboardingScreen({ onEnter }: OnboardingScreenProps) {
  const handleEnter = useCallback(() => {
    onEnter?.();
  }, [onEnter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.isComposing) return;
      if (event.metaKey || event.ctrlKey) return;
      if (isInteractiveKeyboardTarget(event.target)) return;

      handleEnter();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleEnter]);

  return (
    <div className="onboarding-screen relative min-h-dvh overflow-hidden bg-background text-foreground">
      <SceneBackdrop />

      <div className="relative z-1 flex min-h-dvh flex-col px-4 py-5">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold tracking-tight leading-[1.15]">
              OpenCore
            </span>
            <span className="text-[9px] font-medium tracking-[0.14em] text-muted-foreground">
              LOCAL AI WORKSPACE
            </span>
          </div>
          <ThemeToggle />
        </header>

        <section
          className="mx-auto mt-4 flex w-full max-w-[600px] flex-col items-center"
          aria-labelledby="onboarding-headline"
        >
          <div className="h-[300px] w-full">
            <GalaxyOrbCanvas />
          </div>

          <h1
            id="onboarding-headline"
            className="mt-7 max-w-[600px] text-center text-[clamp(1.75rem,4vw,2rem)] font-semibold tracking-tight leading-[1.12] text-balance"
          >
            Your local AI command workspace
          </h1>

          <p className="mt-2.5 max-w-[38rem] text-center font-mono text-xs leading-[1.2] text-muted-foreground text-pretty">
            OpenCore combines chat, terminal, editing, and Rust-native performance
            in one permissioned desktop environment. To leave the crowded cloud,
            polluted by leaks and unconsciousness, to return to a workspace that
            stays on your machine.
          </p>
        </section>

        <footer className="mt-auto flex justify-center pb-2 pt-6">
          <Button
            type="button"
            size="lg"
            className="px-7 py-5"
            onClick={handleEnter}
          >
            Enter OpenCore
          </Button>
        </footer>
      </div>
    </div>
  );
}
