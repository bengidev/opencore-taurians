import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type PlatformTag = "" | "macos" | "windows" | "linux";

let testTag: PlatformTag | undefined;

function createPlatformPromise(): Promise<PlatformTag> {
  if (testTag !== undefined) {
    return Promise.resolve(testTag);
  }
  return invoke<PlatformTag>("app_platform").catch(() => "");
}

/**
 * Resolves once at module load (or when a test tag is forced). Safe to await
 * anywhere. Live binding: tests can re-assign it via `resolvePlatformForTest`.
 */
export let platformPromise: Promise<PlatformTag> = createPlatformPromise();

/**
 * Test helper: force a platform tag and reset the cached promise so the next
 * consumer sees the forced tag.
 *
 * Call this BEFORE components mount: `usePlatform` captures the promise at
 * effect time, so forcing a tag after a component has mounted won't re-fire it.
 */
export function resolvePlatformForTest(tag: PlatformTag): void {
  testTag = tag;
  platformPromise = createPlatformPromise();
}

/** React hook: '' until the platform tag resolves, then the tag. */
export function usePlatform(): PlatformTag {
  const [tag, setTag] = useState<PlatformTag>("");
  useEffect(() => {
    let active = true;
    void platformPromise.then((resolved) => {
      if (active) setTag(resolved);
    });
    return () => {
      active = false;
    };
  }, []);
  return tag;
}

export const IS_MAC = (tag: PlatformTag) => tag === "macos";
export const USE_CUSTOM_WINDOW_CONTROLS = (tag: PlatformTag) =>
  tag !== "" && tag !== "macos";
