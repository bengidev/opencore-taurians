import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedSourceControlCheckout } from "../api/sourceControlContracts";
import { useSourceControlWatchLifecycle } from "./useSourceControlWatchLifecycle";

const invokeMock = vi.fn();
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

const checkout: ResolvedSourceControlCheckout = {
  kind: "project-root",
  scopeId: "scope-1",
  checkoutPath: "/proj",
  checkoutIdentity: "checkout:/proj",
  repositoryIdentity: "repo-1",
  savedRefName: "main",
  managedByApp: false,
  normalizedRestore: {
    kind: "project-root",
    repositoryIdentity: "repo-1",
    savedRefName: "main",
  },
};

describe("useSourceControlWatchLifecycle", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    invokeMock.mockResolvedValue(undefined);
    listenMock.mockResolvedValue(() => {});
  });

  it("subscribes before listening and unsubscribes on cleanup", async () => {
    const { unmount } = renderHook(() =>
      useSourceControlWatchLifecycle("trunk-1", checkout),
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("watch_subscribe", {
        input: {
          scopeId: "scope-1",
          mode: "live",
          identity: "source-control:scope-1",
        },
      });
    });

    expect(listenMock).toHaveBeenCalledWith("watch://changed", expect.any(Function));
    expect(invokeMock.mock.invocationCallOrder[0]).toBeLessThan(
      listenMock.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );

    unmount();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("watch_unsubscribe", {
        input: {
          scopeId: "scope-1",
          identity: "source-control:scope-1",
        },
      });
    });
  });
});
