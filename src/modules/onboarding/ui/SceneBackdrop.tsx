import { useCallback, useRef } from "react";
import { Canvas2DPainter } from "../rendering/canvas2dPainter";
import {
  backdropElapsedSeconds,
  paintSceneBackdrop,
} from "../rendering/sceneBackdrop";
import { useTheme } from "./ThemeProvider";
import { fitCanvasToElement, useAnimationFrame } from "./hooks/canvasRuntime";

export function SceneBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(performance.now());
  const { mode } = useTheme();

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const elapsed = backdropElapsedSeconds(startedAtRef.current, now);
    const { width, height } = fitCanvasToElement(canvas, ctx);

    ctx.clearRect(0, 0, width, height);
    paintSceneBackdrop(
      new Canvas2DPainter(ctx),
      { width, height },
      0,
      0,
      mode,
      elapsed,
    );
  }, [mode]);

  useAnimationFrame(paint);

  return <canvas ref={canvasRef} className="onboarding-scene-backdrop" aria-hidden />;
}
