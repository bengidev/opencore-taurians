import type { Point2, Rgba, Size2 } from "./onboardingColor";

/** Port for any pixel surface the onboarding renderer can target. */
export interface SurfacePainter {
  fillRectangle(origin: Point2, size: Size2, color: Rgba): void;
}
