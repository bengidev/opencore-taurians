import type { Rgba } from "../domain/onboardingTheme";
export type { Rgba } from "../domain/onboardingTheme";
export { rgbaToCss } from "../domain/onboardingTheme";

export const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

export interface Point2 {
  x: number;
  y: number;
}

export interface Size2 {
  width: number;
  height: number;
}

export function withAlpha(color: Rgba, alpha: number): Rgba {
  return { ...color, a: Math.min(1, Math.max(0, alpha)) };
}

export function blend(a: Rgba, b: Rgba, t: number): Rgba {
  const mix = Math.min(1, Math.max(0, t));
  return {
    r: a.r + (b.r - a.r) * mix,
    g: a.g + (b.g - a.g) * mix,
    b: a.b + (b.b - a.b) * mix,
    a: a.a + (b.a - a.a) * mix,
  };
}
