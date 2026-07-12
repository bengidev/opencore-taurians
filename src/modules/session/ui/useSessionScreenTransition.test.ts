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

  it("commits onboarding immediately when enter is instant", () => {
    const onCommitOnboarding = vi.fn();
    const { result } = renderHook(() =>
      useSessionScreenTransition({
        onboardingCompleted: false,
        onCommitOnboarding,
      }),
    );

    act(() => {
      result.current.beginEnter({ instant: true });
    });

    expect(onCommitOnboarding).toHaveBeenCalledOnce();
    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.showShell).toBe(true);
    expect(result.current.isTransitioning).toBe(false);
    expect(result.current.onboardingExiting).toBe(false);
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

  it("cancels pending commit when enter transition is aborted", () => {
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

    act(() => {
      result.current.abortEnterTransition();
    });

    act(() => {
      vi.advanceTimersByTime(280);
    });

    expect(onCommitOnboarding).not.toHaveBeenCalled();
    expect(result.current.showOnboarding).toBe(true);
    expect(result.current.showShell).toBe(false);
    expect(result.current.isTransitioning).toBe(false);
  });
});
