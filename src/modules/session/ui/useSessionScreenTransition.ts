import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shellInstant] = useState(() => onboardingCompleted);
  const [showOnboarding, setShowOnboarding] = useState(!onboardingCompleted);
  const [showShell, setShowShell] = useState(onboardingCompleted);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [onboardingExiting, setOnboardingExiting] = useState(false);
  const [shellVisible, setShellVisible] = useState(onboardingCompleted);

  const clearCommitTimeout = useCallback(() => {
    if (commitTimeoutRef.current === null) return;
    window.clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = null;
  }, []);

  const abortEnterTransition = useCallback(() => {
    clearCommitTimeout();
    enteredShellRef.current = false;
    setShowOnboarding(true);
    setShowShell(false);
    setIsTransitioning(false);
    setOnboardingExiting(false);
    setShellVisible(false);
  }, [clearCommitTimeout]);

  useLayoutEffect(() => {
    if (onboardingCompleted) return;

    abortEnterTransition();
  }, [abortEnterTransition, onboardingCompleted]);

  useLayoutEffect(() => {
    if (!isTransitioning || shellVisible || !showShell) return;

    const frame = window.requestAnimationFrame(() => {
      setShellVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTransitioning, shellVisible, showShell]);

  useEffect(() => clearCommitTimeout, [clearCommitTimeout]);

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
    clearCommitTimeout();
    enteredShellRef.current = true;
    setIsTransitioning(true);
    setShowShell(true);
    setOnboardingExiting(true);
    setShellVisible(false);

    commitTimeoutRef.current = window.setTimeout(() => {
      commitTimeoutRef.current = null;
      onCommitOnboarding();
      setShowOnboarding(false);
      setOnboardingExiting(false);
      setIsTransitioning(false);
    }, transitionMs);
  }, [clearCommitTimeout, onboardingCompleted, onCommitOnboarding]);

  return {
    abortEnterTransition,
    beginEnter,
    showOnboarding,
    showShell,
    isTransitioning,
    onboardingExiting,
    shellVisible,
    shellInstant,
  };
}
