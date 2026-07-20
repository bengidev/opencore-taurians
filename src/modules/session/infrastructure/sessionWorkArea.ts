import type { GuiWindowSize } from "../domain/sessionGuiScale";

export async function readLogicalWorkArea(): Promise<GuiWindowSize | null> {
  try {
    const { currentMonitor } = await import("@tauri-apps/api/window");
    const monitor = await currentMonitor();
    if (!monitor) return null;
    const logical = monitor.workArea.size.toLogical(monitor.scaleFactor);
    return {
      width: Math.floor(logical.width),
      height: Math.floor(logical.height),
    };
  } catch {
    return null;
  }
}
