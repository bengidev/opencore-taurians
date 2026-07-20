import { scaledWindowSize } from "../domain/sessionGuiScale";
import { readLogicalWorkArea } from "./sessionWorkArea";

export interface WindowSize {
  width: number;
  height: number;
}

export const ONBOARDING_WINDOW_SIZE: WindowSize = { width: 960, height: 680 };
export const SHELL_WINDOW_SIZE: WindowSize = { width: 1280, height: 800 };

export interface WindowController {
  applyOnboardingSize(scale?: number): Promise<void>;
  applyShellSize(scale?: number): Promise<void>;
}

export interface MemoryWindowController extends WindowController {
  lastSize: WindowSize | null;
  centerCount: number;
}

export function createMemoryWindowController(options?: {
  workArea?: { width: number; height: number } | null;
}): MemoryWindowController {
  const workArea = options?.workArea ?? null;
  const controller: MemoryWindowController = {
    lastSize: null,
    centerCount: 0,
    async applyOnboardingSize(scale = 1) {
      controller.lastSize = scaledWindowSize(
        ONBOARDING_WINDOW_SIZE,
        scale,
        workArea,
      );
      controller.centerCount += 1;
    },
    async applyShellSize(scale = 1) {
      controller.lastSize = scaledWindowSize(SHELL_WINDOW_SIZE, scale, workArea);
      controller.centerCount += 1;
    },
  };
  return controller;
}

async function resizeAndCenter(
  base: WindowSize,
  scale: number,
): Promise<void> {
  try {
    const workArea = await readLogicalWorkArea();
    const size = scaledWindowSize(base, scale, workArea);
    const { getCurrentWindow, LogicalSize } = await import(
      "@tauri-apps/api/window"
    );
    const window = getCurrentWindow();
    await window.setSize(new LogicalSize(size.width, size.height));
    await window.center();
  } catch {
    // keep zoom; leave window unchanged
  }
}

export function createTauriWindowController(): WindowController {
  return {
    async applyOnboardingSize(scale = 1) {
      await resizeAndCenter(ONBOARDING_WINDOW_SIZE, scale);
    },
    async applyShellSize(scale = 1) {
      await resizeAndCenter(SHELL_WINDOW_SIZE, scale);
    },
  };
}
