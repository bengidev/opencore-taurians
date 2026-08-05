import { describe, expect, it, vi, beforeEach } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { act, renderHook } from "@testing-library/react";

describe("platform", () => {
  beforeEach(() => {
    // Each test gets a fresh module instance so platformPromise is created
    // from the invoke mock state set up for that test (cache-aware: the
    // module-level promise resolves once per instance).
    vi.resetModules();
    invokeMock.mockReset();
  });

  it("resolves the platform tag from the Rust command", async () => {
    invokeMock.mockResolvedValue("macos");
    const { platformPromise } = await import("./platform");

    const tag = await platformPromise;
    expect(tag).toBe("macos");
    expect(invokeMock).toHaveBeenCalledWith("app_platform");
  });

  it("usePlatform returns '' until resolved, then the tag", async () => {
    let resolve!: (t: string) => void;
    invokeMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { usePlatform } = await import("./platform");

    const { result } = renderHook(() => usePlatform());
    expect(result.current).toBe("");
    await act(async () => {
      resolve("windows");
    });
    expect(result.current).toBe("windows");
  });

  it("resolvePlatformForTest overrides for tests", async () => {
    invokeMock.mockResolvedValue("macos");
    const mod = await import("./platform");

    mod.resolvePlatformForTest("linux");
    const tag = await mod.platformPromise;
    expect(tag).toBe("linux");
  });
});
