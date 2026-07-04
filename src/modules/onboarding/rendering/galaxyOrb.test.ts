import { describe, expect, it } from "vitest";
import type { Point2, Rgba, Size2 } from "./color";
import { paintGalaxyOrb } from "./galaxyOrb";
import type { SurfacePainter } from "./surfacePainter";

class RecordingPainter implements SurfacePainter {
  readonly rectangles: Array<{
    origin: Point2;
    size: Size2;
    color: Rgba;
  }> = [];

  fillRectangle(origin: Point2, size: Size2, color: Rgba): void {
    this.rectangles.push({ origin, size, color });
  }
}

describe("paintGalaxyOrb", () => {
  it("renders a particle field for the active theme", () => {
    const painter = new RecordingPainter();

    paintGalaxyOrb(
      painter,
      { origin: { x: 0, y: 0 }, size: { width: 520, height: 340 } },
      {
        mode: "dark",
        startedAtMs: 0,
        nowMs: 1_000,
        speedMultiplier: 1,
        zoom: 1,
      },
    );

    expect(painter.rectangles.length).toBeGreaterThan(100);
  });
});
