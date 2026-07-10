import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionScreenTransitionMs } from "./sessionScreenTransition";

interface UseSessionScreenTransitionOptions {
  onboardingCompleted: boolean;
  onCommitOnboarding: () => void;
}

export function useSessionScreenTransition({
  onboardingCompleted,
  onCommitOnboarding,
}: UseSessionScreenTransitionOptions) {
  const enteredShellRef = useRef(onboardingCompleted);
  const [shellInstant] = useState(() => onboardingCompleted);
  const [showOnboarding, setShowOnboarding] = useState(!onboardingCompleted);
  const [showShell, setShowShell] = useState(onboardingCompleted);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [onboardingExiting, setOnboardingExiting] = useState(false);
  const [shellVisible, setShellVisible] = useState(onboardingCompleted);

  useEffect(() => {
    if (onboardingCompleted) return;

    enteredShellRef.current = false;
    setShowOnboarding(true);
    setShowShell(false);
    setIsTransitioning(false);
    setOnboardingExiting(false);
    setShellVisible(false);
  }, [onboardingCompleted]);

  const beginEnter = useCallback(() => {
    if (enteredShellRef.current || onboardingCompleted) {
      onCommitOnboarding();
      enteredShellRef.current = true;
      setShowOnboarding(false);
      setShowShell(true);
      setShellVisible(true);
      return;
    }

    const transitionMs = getSessionScreenTransitionMs();
    enteredShellRef.current = true;
    setIsTransitioning(true);
    setShowShell(true);
    setOnboardingExiting(true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShellVisible(true));
    });

    window.setTimeout(() => {
      onCommitOnboarding();
      setShowOnboarding(false);
      setOnboardingExiting(false);
      setIsTransitioning(false);
    }, transitionMs);
  }, [onboardingCompleted, onCommitOnboarding]);

  return {
    beginEnter,
    showOnboarding,
    showShell,
    isTransitioning,
    onboardingExiting,
    shellVisible,
    shellInstant,
  };
}
