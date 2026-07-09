export interface WindowSize {
  width: number;
  height: number;
}

export const ONBOARDING_WINDOW_SIZE: WindowSize = { width: 960, height: 680 };
export const SHELL_WINDOW_SIZE: WindowSize = { width: 1280, height: 800 };

export interface WindowController {
  applyOnboardingSize(): Promise<void>;
  applyShellSize(): Promise<void>;
}

export interface MemoryWindowController extends WindowController {
  lastSize: WindowSize | null;
  centerCount: number;
}

export function createMemoryWindowController(): MemoryWindowController {
  const controller: MemoryWindowController = {
    lastSize: null,
    centerCount: 0,
    async applyOnboardingSize() {
      controller.lastSize = { ...ONBOARDING_WINDOW_SIZE };
      controller.centerCount += 1;
    },
    async applyShellSize() {
      controller.lastSize = { ...SHELL_WINDOW_SIZE };
      controller.centerCount += 1;
    },
  };
  return controller;
}

export function createTauriWindowController(): WindowController {
  return {
    async applyOnboardingSize() {
      await resizeAndCenter(ONBOARDING_WINDOW_SIZE);
    },
    async applyShellSize() {
      await resizeAndCenter(SHELL_WINDOW_SIZE);
    },
  };
}

async function resizeAndCenter(size: WindowSize): Promise<void> {
  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  await window.setSize(new LogicalSize(size.width, size.height));
  await window.center();
}
