import type { ThemeMode } from "../domain/theme";
import { foreground } from "../domain/theme";
import { Point2, Size2, withAlpha } from "./color";
import type { SurfacePainter } from "./surfacePainter";

export function paintSceneBackdrop(
  painter: SurfacePainter,
  size: Size2,
  originX: number,
  originY: number,
  mode: ThemeMode,
  elapsedSeconds: number,
): void {
  const muted = foreground(mode, "muted");
  const dotColor = withAlpha(muted, 0.12);
  drawDotGrid(painter, size, originX, originY, dotColor, elapsedSeconds);
}

function drawDotGrid(
  painter: SurfacePainter,
  size: Size2,
  originX: number,
  originY: number,
  color: { r: number; g: number; b: number; a: number },
  t: number,
): void {
  const spacing = 28;
  const drift = Math.sin(t * 0.08) * 2;
  const cols = Math.ceil(size.width / spacing) + 1;
  const rows = Math.ceil(size.height / spacing) + 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = originX + col * spacing + drift;
      const y = originY + row * spacing - drift * 0.5;
      const edge = edgeFade(x - originX, y - originY, size);
      const alpha = color.a * edge;
      if (alpha < 0.01) continue;

      const dot = 1.2;
      painter.fillRectangle(
        { x: x - dot * 0.5, y: y - dot * 0.5 },
        { width: dot, height: dot },
        { ...color, a: alpha },
      );
    }
  }
}

function edgeFade(x: number, y: number, size: Size2): number {
  const nx = Math.abs(x / size.width - 0.5) * 2;
  const ny = Math.abs(y / size.height - 0.5) * 2;
  const edge = Math.max(nx, ny);
  return Math.min(1, Math.max(0, 1 - Math.max(0, edge - 0.55) * 2.2));
}

export function backdropElapsedSeconds(
  startedAtMs: number,
  nowMs: number,
): number {
  return Math.max(0, (nowMs - startedAtMs) / 1000);
}

export type { Point2, Size2 };
