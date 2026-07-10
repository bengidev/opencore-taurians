export const SESSION_SCREEN_TRANSITION_MS = 280;
export const SESSION_SCREEN_TRANSITION_EASE =
  "cubic-bezier(0.23, 1, 0.32, 1)";

export function getSessionScreenTransitionMs(): number {
  if (typeof window === "undefined") return SESSION_SCREEN_TRANSITION_MS;
  if (typeof window.matchMedia !== "function") {
    return SESSION_SCREEN_TRANSITION_MS;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : SESSION_SCREEN_TRANSITION_MS;
}
