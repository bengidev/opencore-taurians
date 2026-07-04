import type { Point2, Rgba, Size2 } from "./onboardingColor";
import type { SurfacePainter } from "./onboardingSurfacePainter";

function rgbaToCss(color: Rgba): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${color.a})`;
}

/** Canvas 2D adapter for the rendering port. */
export class Canvas2DPainter implements SurfacePainter {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  fillRectangle(origin: Point2, size: Size2, color: Rgba): void {
    this.ctx.fillStyle = rgbaToCss(color);
    this.ctx.fillRect(origin.x, origin.y, size.width, size.height);
  }
}
