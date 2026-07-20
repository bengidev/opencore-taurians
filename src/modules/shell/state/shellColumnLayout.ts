import { MIN_SHELL_PANEL_WIDTH } from "./shellPanelSizing";

export const SHELL_LAYOUT_REFERENCE_WIDTH = 1280;
export const MIN_SHELL_CENTER_WIDTH = 320;

export type ShellColumnWidths = {
  left: number;
  center: number;
  right: number;
};

export type DistributeShellColumnWidthsInput = {
  available: number;
  leftPreferred: number;
  rightPreferred: number;
  leftVisible: boolean;
  rightVisible: boolean;
};

export function distributeShellColumnWidths(
  input: DistributeShellColumnWidthsInput,
): ShellColumnWidths {
  const available = Number.isFinite(input.available)
    ? Math.max(0, Math.round(input.available))
    : 0;
  const leftTarget = input.leftVisible ? input.leftPreferred : 0;
  const rightTarget = input.rightVisible ? input.rightPreferred : 0;

  let left: number;
  let right: number;
  let center: number;

  if (available >= SHELL_LAYOUT_REFERENCE_WIDTH) {
    left = leftTarget;
    right = rightTarget;
    center = available - left - right;
  } else {
    const scale =
      SHELL_LAYOUT_REFERENCE_WIDTH > 0
        ? available / SHELL_LAYOUT_REFERENCE_WIDTH
        : 0;
    left = input.leftVisible ? Math.round(leftTarget * scale) : 0;
    right = input.rightVisible ? Math.round(rightTarget * scale) : 0;
    center = available - left - right;
  }

  if (input.leftVisible) left = Math.max(MIN_SHELL_PANEL_WIDTH, left);
  if (input.rightVisible) right = Math.max(MIN_SHELL_PANEL_WIDTH, right);
  center = Math.max(MIN_SHELL_CENTER_WIDTH, center);

  // If floors fit, re-balance center so the sum matches available.
  const panels = left + right;
  if (panels + MIN_SHELL_CENTER_WIDTH <= available) {
    center = available - panels;
  }

  return { left, center, right };
}
