import type { Point2, Rgba, Size2 } from "./onboardingColor";
import { rgbaToCss } from "./onboardingColor";
import type { SurfacePainter } from "./onboardingSurfacePainter";

/** Canvas 2D adapter for the rendering port. */
export class Canvas2DPainter implements SurfacePainter {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  fillRectangle(origin: Point2, size: Size2, color: Rgba): void {
    this.ctx.fillStyle = rgbaToCss(color);
    this.ctx.fillRect(origin.x, origin.y, size.width, size.height);
  }
}
