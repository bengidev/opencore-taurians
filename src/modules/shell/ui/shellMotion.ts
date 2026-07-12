import {
  DURATION_UI_PANEL_HIDE_MS,
  DURATION_UI_PANEL_SHOW_MS,
  EASE_DRAWER,
  EASE_OUT,
  prefersReducedMotion,
} from "../../../../design-system/motion";

export const SHELL_EASE_OUT = EASE_OUT;
export const SHELL_EASE_DRAWER = EASE_DRAWER;
export const SHELL_SHOW_MS = DURATION_UI_PANEL_SHOW_MS;
export const SHELL_HIDE_MS = DURATION_UI_PANEL_HIDE_MS;

export { prefersReducedMotion };

export function scheduleReveal(setRevealed: (revealed: boolean) => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => setRevealed(true));
  });
}
