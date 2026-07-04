import { useCallback, useRef } from "react";
import { Canvas2DPainter } from "../rendering/canvas2dPainter";
import { paintGalaxyOrb } from "../rendering/galaxyOrb";
import { useTheme } from "./ThemeProvider";
import {
  fitCanvasToElement,
  useAnimationFrame,
  useOrbDynamics,
} from "./hooks/canvasRuntime";

export function GalaxyOrbCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(performance.now());
  const { mode } = useTheme();
  const { tick, press, release } = useOrbDynamics();

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dynamics = tick();
    const now = performance.now();
    const { width, height } = fitCanvasToElement(canvas, ctx);

    ctx.clearRect(0, 0, width, height);
    paintGalaxyOrb(
      new Canvas2DPainter(ctx),
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
      aria-hidden
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    />
  );
}
