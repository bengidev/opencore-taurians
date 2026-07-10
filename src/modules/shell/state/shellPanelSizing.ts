export const DEFAULT_SHELL_PANEL_WIDTH = 208;
export const MIN_SHELL_PANEL_WIDTH = 160;
export const MAX_SHELL_PANEL_WIDTH = 480;

export function clampShellPanelWidth(width: number): number {
  return Math.min(
    MAX_SHELL_PANEL_WIDTH,
    Math.max(MIN_SHELL_PANEL_WIDTH, Math.round(width)),
  );
}
