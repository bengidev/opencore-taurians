export const MAX_SPEED_MULTIPLIER = 3.0;
export const SPEED_CLAMP = MAX_SPEED_MULTIPLIER + 0.5;
export const MAX_ZOOM = 1.6;

const HOLD_RAMP_PER_SEC = 0.6;
const RELEASE_RAMP_PER_SEC = 0.9;

export interface OrbMotion {
  speed: number;
  zoom: number;
}

export interface OrbDynamicsState {
  isHolding: boolean;
  holdProgress: number;
  motion: OrbMotion;
}

export type OrbDynamicsEvent =
  | { type: "pointer_down" }
  | { type: "pointer_up" }
  | { type: "tick"; dtSeconds: number };

export function motionForProgress(progress: number): OrbMotion {
  const p = Math.min(1, Math.max(0, progress));
  return {
    speed: 1 + (MAX_SPEED_MULTIPLIER - 1) * p,
    zoom: 1 + (MAX_ZOOM - 1) * p,
  };
}

export function initialOrbDynamicsState(): OrbDynamicsState {
  return {
    isHolding: false,
    holdProgress: 0,
    motion: motionForProgress(0),
  };
}

export function reduceOrbDynamics(
  state: OrbDynamicsState,
  event: OrbDynamicsEvent,
): OrbDynamicsState {
  switch (event.type) {
    case "pointer_down":
      return { ...state, isHolding: true };
    case "pointer_up":
      return { ...state, isHolding: false };
    case "tick": {
      const dt = Math.min(0.25, Math.max(0, event.dtSeconds));
      const delta = state.isHolding
        ? HOLD_RAMP_PER_SEC * dt
        : -RELEASE_RAMP_PER_SEC * dt;
      const holdProgress = Math.min(1, Math.max(0, state.holdProgress + delta));
      return {
        ...state,
        holdProgress,
        motion: motionForProgress(holdProgress),
      };
    }
  }
}
