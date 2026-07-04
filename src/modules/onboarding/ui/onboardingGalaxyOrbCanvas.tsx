import { useCallback, useRef } from "react";
import { Canvas2DPainter } from "../rendering/onboardingCanvas2dPainter";
import { paintGalaxyOrb } from "../rendering/onboardingGalaxyOrb";
import { useTheme } from "./onboardingThemeContext";
import {
  fitCanvasToElement,
  useAnimationFrame,
  useOrbDynamics,
} from "./hooks/onboardingCanvasRuntime";

export function GalaxyOrbCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(performance.now());
  const painterRef = useRef<Canvas2DPainter | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const { mode } = useTheme();
  const { tick, press, release } = useOrbDynamics();

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

    const dynamics = tick();
    const now = performance.now();
    const { width, height } = fitCanvasToElement(canvas, ctx);

    ctx.clearRect(0, 0, width, height);
    paintGalaxyOrb(
      painter,
      { origin: { x: 0, y: 0 }, size: { width, height } },
      {
        mode,
        startedAtMs: startedAtRef.current,
        nowMs: now,
        speedMultiplier: dynamics.motion.speed,
        zoom: dynamics.motion.zoom,
      },
    );
  }, [mode, tick]);

  useAnimationFrame(paint);

  return (
    <canvas
      ref={canvasRef}
      className="onboarding-galaxy-orb"
      role="img"
      aria-label="Animated galaxy orb. Press and hold to zoom in."
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    />
  );
}
