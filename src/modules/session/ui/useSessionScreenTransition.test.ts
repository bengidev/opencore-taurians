import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionScreenTransition } from "./useSessionScreenTransition";

describe("useSessionScreenTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("crossfades into the shell before committing onboarding", () => {
    const onCommitOnboarding = vi.fn();
    const { result } = renderHook(() =>
      useSessionScreenTransition({
        onboardingCompleted: false,
        onCommitOnboarding,
      }),
    );

    act(() => {
      result.current.beginEnter();
    });

    expect(result.current.showShell).toBe(true);
    expect(result.current.onboardingExiting).toBe(true);
    expect(result.current.isTransitioning).toBe(true);
    expect(onCommitOnboarding).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(280);
    });

    expect(onCommitOnboarding).toHaveBeenCalledOnce();
    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.isTransitioning).toBe(false);
  });

  it("skips transition for returning users", () => {
    const onCommitOnboarding = vi.fn();
    const { result } = renderHook(() =>
      useSessionScreenTransition({
        onboardingCompleted: true,
        onCommitOnboarding,
      }),
    );

    expect(result.current.showShell).toBe(true);
    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.shellInstant).toBe(true);
  });
});
