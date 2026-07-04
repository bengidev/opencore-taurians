import { useCallback, useEffect, useRef } from "react";
import {
  initialOrbDynamicsState,
  reduceOrbDynamics,
  type OrbDynamicsState,
} from "../../domain/onboardingOrbDynamics";

export function useOrbDynamics() {
  const stateRef = useRef<OrbDynamicsState>(initialOrbDynamicsState());
  const lastFrameRef = useRef(performance.now());

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = (now - lastFrameRef.current) / 1000;
    lastFrameRef.current = now;
    stateRef.current = reduceOrbDynamics(stateRef.current, {
      type: "tick",
      dtSeconds: dt,
    });
    return stateRef.current;
  }, []);

  const press = useCallback(() => {
    stateRef.current = reduceOrbDynamics(stateRef.current, {
      type: "pointer_down",
    });
  }, []);

  const release = useCallback(() => {
    stateRef.current = reduceOrbDynamics(stateRef.current, {
      type: "pointer_up",
    });
  }, []);

  return { tick, press, release };
}

type FrameCallback = () => void;

const frameSubscribers = new Set<FrameCallback>();
let frameId = 0;
let frameLoopActive = false;

function runFrameLoop(): void {
  if (!document.hidden) {
    for (const callback of frameSubscribers) {
      callback();
    }
  }
  frameId = requestAnimationFrame(runFrameLoop);
}

function ensureFrameLoop(): void {
  if (!frameLoopActive && frameSubscribers.size > 0) {
    frameLoopActive = true;
    frameId = requestAnimationFrame(runFrameLoop);
  }
}

function stopFrameLoopIfIdle(): void {
  if (frameLoopActive && frameSubscribers.size === 0) {
    cancelAnimationFrame(frameId);
    frameLoopActive = false;
  }
}

/** Shared rAF bus for onboarding canvases — one loop, pauses when tab is hidden. */
export function useAnimationFrame(callback: () => void): void {
  useEffect(() => {
    frameSubscribers.add(callback);
    ensureFrameLoop();
    return () => {
      frameSubscribers.delete(callback);
      stopFrameLoopIfIdle();
    };
  }, [callback]);
}

export function fitCanvasToElement(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  const pixelWidth = Math.max(1, Math.floor(width * dpr));
  const pixelHeight = Math.max(1, Math.floor(height * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { width, height };
}
