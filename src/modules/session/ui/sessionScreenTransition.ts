import {
  DURATION_UI_POPOVER_MS,
  DURATION_UI_SESSION_MS,
  EASE_OUT,
} from "../../../../design-system/motion";

export const SESSION_SCREEN_TRANSITION_MS = DURATION_UI_SESSION_MS;
export const SESSION_SCREEN_TRANSITION_EASE = EASE_OUT;

export function getSessionScreenTransitionMs(): number {
  if (typeof window === "undefined") return SESSION_SCREEN_TRANSITION_MS;
  if (typeof window.matchMedia !== "function") {
    return SESSION_SCREEN_TRANSITION_MS;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? DURATION_UI_POPOVER_MS
    : SESSION_SCREEN_TRANSITION_MS;
}
