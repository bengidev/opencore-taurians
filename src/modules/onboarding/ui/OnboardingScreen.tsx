import { useCallback, useEffect } from "react";
import { GalaxyOrbCanvas } from "./GalaxyOrbCanvas";
import { SceneBackdrop } from "./SceneBackdrop";
import { ThemeToggle } from "./ThemeToggle";

export interface OnboardingScreenProps {
  onEnter?: () => void;
}

export function OnboardingScreen({ onEnter }: OnboardingScreenProps) {
  const handleEnter = useCallback(() => {
    onEnter?.();
  }, [onEnter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        !event.repeat &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        handleEnter();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleEnter]);

  return (
    <div className="onboarding" tabIndex={-1}>
      <SceneBackdrop />

      <div className="onboarding__content">
        <header className="onboarding__header">
          <div className="onboarding__brand">
            <span className="onboarding__title">OpenCore</span>
            <span className="onboarding__tagline">LOCAL AI WORKSPACE</span>
          </div>
          <ThemeToggle />
        </header>

        <section
          className="onboarding__hero"
          aria-labelledby="onboarding-headline"
        >
          <div className="onboarding__orb-shell">
            <GalaxyOrbCanvas />
          </div>

          <h1 id="onboarding-headline" className="onboarding__headline">
            Your local AI command workspace
          </h1>

          <p className="onboarding__description">
            OpenCore combines chat, terminal, editing, and Rust-native performance
            in one permissioned desktop environment. To leave the crowded cloud,
            polluted by leaks and unconsciousness, to return to a workspace that
            stays on your machine.
          </p>
        </section>

        <footer className="onboarding__footer">
          <button
            type="button"
            className="onboarding__cta"
            onClick={handleEnter}
          >
            Enter OpenCore
          </button>
        </footer>
      </div>
    </div>
  );
}
