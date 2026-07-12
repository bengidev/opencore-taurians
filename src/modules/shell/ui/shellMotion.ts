import {
  DURATION_UI_PANEL_HIDE_MS,
  DURATION_UI_PANEL_SHOW_MS,
  EASE_DRAWER,
  EASE_OUT,
} from "../../../../design-system/motion";

export const SHELL_EASE_OUT = EASE_OUT;
export const SHELL_EASE_DRAWER = EASE_DRAWER;
export const SHELL_SHOW_MS = DURATION_UI_PANEL_SHOW_MS;
export const SHELL_HIDE_MS = DURATION_UI_PANEL_HIDE_MS;

export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scheduleReveal(setRevealed: (revealed: boolean) => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => setRevealed(true));
  });
}
