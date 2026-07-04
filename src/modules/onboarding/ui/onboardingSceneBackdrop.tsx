import { useCallback, useRef } from "react";
import { Canvas2DPainter } from "../rendering/onboardingCanvas2dPainter";
import {
  backdropElapsedSeconds,
  paintSceneBackdrop,
} from "../rendering/onboardingSceneBackdrop";
import { useTheme } from "./onboardingThemeContext";
import { fitCanvasToElement, useAnimationFrame } from "./hooks/onboardingCanvasRuntime";

export function SceneBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(performance.now());
  const painterRef = useRef<Canvas2DPainter | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const { mode } = useTheme();

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (ctx !== ctxRef.current) {
      ctxRef.current = ctx;
      painterRef.current = new Canvas2DPainter(ctx);
    }

    const painter = painterRef.current;
    if (!painter) return;

    const now = performance.now();
    const elapsed = backdropElapsedSeconds(startedAtRef.current, now);
    const { width, height } = fitCanvasToElement(canvas, ctx);

    ctx.clearRect(0, 0, width, height);
    paintSceneBackdrop(painter, { width, height }, 0, 0, mode, elapsed);
  }, [mode]);

  useAnimationFrame(paint);

  return <canvas ref={canvasRef} className="onboarding-scene-backdrop" aria-hidden />;
}
