export const SHELL_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const SHELL_EASE_DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";
export const SHELL_SHOW_MS = 260;
export const SHELL_HIDE_MS = 180;

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
