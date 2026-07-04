import { describe, expect, it } from "vitest";
import {
  MAX_SPEED_MULTIPLIER,
  MAX_ZOOM,
  initialOrbDynamicsState,
  motionForProgress,
  reduceOrbDynamics,
} from "./onboardingOrbDynamics";

describe("motionForProgress", () => {
  it("returns baseline motion at zero hold progress", () => {
    expect(motionForProgress(0)).toEqual({ speed: 1, zoom: 1 });
  });

  it("returns maximum motion at full hold progress", () => {
    expect(motionForProgress(1)).toEqual({
      speed: MAX_SPEED_MULTIPLIER,
      zoom: MAX_ZOOM,
    });
  });
});

describe("reduceOrbDynamics", () => {
  it("ramps hold progress while the pointer is down", () => {
    let state = initialOrbDynamicsState();
    state = reduceOrbDynamics(state, { type: "pointer_down" });
    state = reduceOrbDynamics(state, { type: "tick", dtSeconds: 0.2 });

    expect(state.holdProgress).toBeGreaterThan(0);
    expect(state.motion.speed).toBeGreaterThan(1);
  });

  it("releases hold progress after pointer up", () => {
    let state = initialOrbDynamicsState();
    state = reduceOrbDynamics(state, { type: "pointer_down" });
    state = reduceOrbDynamics(state, { type: "tick", dtSeconds: 0.5 });
    const peak = state.holdProgress;

    state = reduceOrbDynamics(state, { type: "pointer_up" });
    state = reduceOrbDynamics(state, { type: "tick", dtSeconds: 0.5 });

    expect(peak).toBeGreaterThan(0);
    expect(state.holdProgress).toBeLessThan(peak);
  });
});
