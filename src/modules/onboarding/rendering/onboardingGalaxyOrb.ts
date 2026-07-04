import type { ThemeMode } from "../domain/onboardingTheme";
import {
  foreground,
  surface,
  type BackgroundToken,
  type ForegroundToken,
} from "../domain/onboardingTheme";
import { MAX_ZOOM, SPEED_CLAMP } from "../domain/onboardingOrbDynamics";
import {
  blend,
  Point2,
  Rgba,
  Size2,
  WHITE,
  withAlpha,
} from "./onboardingColor";
import type { SurfacePainter } from "./onboardingSurfacePainter";

const LOGICAL_SIZE: Size2 = { width: 520, height: 340 };

const DISC_RADIUS = 148;
const DISC_TILT = 0.4;
const ARM_COUNT = 2;
const ARM_PITCH = 0.42;
const ARM_WIDTH = 0.55;

const DISC_STAR_COUNT = 360;
const ARM_SATELLITE_COUNT = 96;
const HALO_STAR_COUNT = 168;
const GLOBULAR_CLUSTER_COUNT = 36;
const BULGE_BLOCK_COUNT = 70;
const NUCLEUS_BLOCK_COUNT = 30;
const STARFIELD_COUNT = 90;
const JET_SEGMENTS = 16;

const SNAP_GRID = 3;
const TAU = Math.PI * 2;

interface GalaxyPalette {
  armYoung: Rgba;
  armOld: Rgba;
  bulge: Rgba;
  nucleus: Rgba;
  hiiRegion: Rgba;
  dust: Rgba;
  halo: Rgba;
  jet: Rgba;
  starfield: Rgba;
  core: Rgba;
  rim: Rgba;
}

function rgbaFromTheme(mode: ThemeMode, token: ForegroundToken | BackgroundToken, kind: "fg" | "bg"): Rgba {
  const color =
    kind === "fg"
      ? foreground(mode, token as ForegroundToken)
      : surface(mode, token as BackgroundToken);
  return { ...color, a: 1 };
}

function paletteFromTheme(mode: ThemeMode): GalaxyPalette {
  const primary = rgbaFromTheme(mode, "primary", "fg");
  const secondary = rgbaFromTheme(mode, "secondary", "fg");
  const muted = rgbaFromTheme(mode, "muted", "fg");
  const accent = rgbaFromTheme(mode, "accent", "fg");
  const tertiary = rgbaFromTheme(mode, "tertiary", "bg");

  return {
    armYoung: primary,
    armOld: secondary,
    bulge: accent,
    nucleus: primary,
    hiiRegion: blend(secondary, accent, 0.35),
    dust: tertiary,
    halo: muted,
    jet: accent,
    starfield: primary,
    core: primary,
    rim: muted,
  };
}

function radialTint(
  pal: GalaxyPalette,
  base: Rgba,
  r: number,
  strength: number,
): Rgba {
  const clamped = Math.min(1, Math.max(0, r));
  const rimWeight = Math.min(1, Math.max(0, (clamped - 0.3) / 0.4));
  const accent = blend(pal.core, pal.rim, rimWeight);
  return blend(base, accent, strength);
}

export interface GalaxyOrbParams {
  mode: ThemeMode;
  startedAtMs: number;
  nowMs: number;
  speedMultiplier: number;
  zoom: number;
}

export function paintGalaxyOrb(
  painter: SurfacePainter,
  bounds: { origin: Point2; size: Size2 },
  params: GalaxyOrbParams,
): void {
  const speedMultiplier = Math.min(
    SPEED_CLAMP,
    Math.max(0, params.speedMultiplier),
  );
  const zoom = Math.min(MAX_ZOOM, Math.max(1, params.zoom));
  const t =
    ((params.nowMs - params.startedAtMs) / 1000) * speedMultiplier;
  const pal = paletteFromTheme(params.mode);
  const { width, height } = bounds.size;
  const { x: originX, y: originY } = bounds.origin;

  const fitScale = Math.min(
    width / LOGICAL_SIZE.width,
    height / LOGICAL_SIZE.height,
  );
  const scale = fitScale * zoom;
  const translate: Point2 = {
    x: originX + (width - LOGICAL_SIZE.width * scale) * 0.5,
    y: originY + (height - LOGICAL_SIZE.height * scale) * 0.5,
  };
  const project = (p: Point2): Point2 => ({
    x: translate.x + p.x * scale,
    y: translate.y + p.y * scale,
  });

  drawStarfield(painter, pal, t, scale, project);
  drawGalacticHalo(painter, pal, t, scale, project);
  drawJet(painter, pal, t, scale, project);
  drawGlobularClusters(painter, pal, t, scale, project);
  drawDisc(painter, pal, t, scale, project);
  drawArmSatellites(painter, pal, t, scale, project);
  drawBulge(painter, pal, t, scale, project);
  drawNucleus(painter, pal, t, scale, project);
  drawScanline(painter, pal, t, scale, project);
}

function drawStarfield(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  for (let i = 0; i < STARFIELD_COUNT; i++) {
    const seed = 13700 + i;
    const x = noise(seed, 3) * LOGICAL_SIZE.width;
    const y = noise(seed, 7) * LOGICAL_SIZE.height;

    const dx = x - LOGICAL_SIZE.width * 0.5;
    const dy = (y - LOGICAL_SIZE.height * 0.5) / DISC_TILT;
    if (Math.hypot(dx, dy) < DISC_RADIUS * 0.65) continue;

    const phase = noise(seed, 19) * TAU;
    const twinkle = (Math.sin(t * 1.2 + phase) * 0.5 + 0.5) ** 1.4;
    const alpha = Math.min(1, Math.max(0, 0.05 + twinkle * 0.4));
    const size = Math.max(1, scale) * (0.9 + noise(seed, 31) * 1.1);
    const color = pal.starfield;

    const p = project({ x: snap(x), y: snap(y) });
    painter.fillRectangle(
      { x: p.x - size * 0.5, y: p.y - size * 0.5 },
      { width: size, height: size },
      withAlpha(color, alpha),
    );
  }
}

function drawGalacticHalo(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const cool = pal.halo;
  const center = {
    x: LOGICAL_SIZE.width * 0.5,
    y: LOGICAL_SIZE.height * 0.5,
  };

  for (let i = 0; i < HALO_STAR_COUNT; i++) {
    const seed = 2900 + i;
    const radial = 0.92 + noise(seed, 3) ** 0.65 * 0.55;
    const angle =
      noise(seed, 11) * TAU + t * (0.04 + noise(seed, 19) * 0.03);

    const jitterX = (noise(seed, 29) - 0.5) * 12;
    const jitterY = (noise(seed, 37) - 0.5) * 9;

    const p = {
      x: center.x + Math.cos(angle) * DISC_RADIUS * radial + jitterX,
      y: center.y + Math.sin(angle) * DISC_RADIUS * radial * DISC_TILT + jitterY,
    };

    const phase = noise(seed, 47) * TAU;
    const twinkle = (Math.sin(t * 0.7 + phase) * 0.5 + 0.5) * 0.18;
    const alpha = 0.06 + twinkle;
    const size = (1 + noise(seed, 53) * 1.6) * scale;
    const color = radialTint(pal, cool, radial, 0.7);

    const projected = project(p);
    painter.fillRectangle(
      { x: projected.x - size * 0.5, y: projected.y - size * 0.5 },
      { width: size, height: size },
      withAlpha(color, alpha),
    );
  }
}

function drawJet(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const warm = pal.nucleus;
  const cool = pal.jet;
  const center = {
    x: LOGICAL_SIZE.width * 0.5,
    y: LOGICAL_SIZE.height * 0.5,
  };

  const swell = (Math.sin(t * 0.35) * 0.5 + 0.5) ** 1.4;
  const intensity = 0.35 + swell * 0.55;
  const inner = 12;
  const outer = 96;

  for (const direction of [-1, 1]) {
    for (let s = 0; s < JET_SEGMENTS; s++) {
      const f = s / (JET_SEGMENTS - 1);
      const r = inner + (outer - inner) * f;
      const wobble = Math.sin(t * 0.6 + f * 6 + direction) * (1 + f * 3.5);
      const rawX = center.x + wobble;
      const rawY = center.y + direction * r;

      const p = project({ x: snap(rawX), y: snap(rawY) });
      const falloff = (1 - f) ** 1.1;
      const alpha = Math.min(1, Math.max(0, intensity * falloff * 0.55));
      const width = Math.max(1, 3 - f * 1.6) * scale;
      const height = (2 + falloff * 1.8) * scale;

      const baseColour = blend(warm, cool, f * 0.85);
      const colour = radialTint(pal, baseColour, 0.8, 0.7);

      painter.fillRectangle(
        { x: p.x - width * 0.5, y: p.y - height * 0.5 },
        { width, height },
        withAlpha(colour, alpha),
      );

      if (f < 0.55) {
        const sideSize = Math.max(1, scale);
        for (const off of [-1, 1]) {
          painter.fillRectangle(
            {
              x: p.x + off * width * 0.65 - sideSize * 0.5,
              y: p.y - sideSize * 0.5,
            },
            { width: sideSize, height: sideSize },
            withAlpha(colour, alpha * 0.5),
          );
        }
      }
    }
  }
}

function drawGlobularClusters(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const center = {
    x: LOGICAL_SIZE.width * 0.5,
    y: LOGICAL_SIZE.height * 0.5,
  };

  for (let i = 0; i < GLOBULAR_CLUSTER_COUNT; i++) {
    const seed = 11200 + i;
    const angleOffset = noise(seed, 13) * TAU;
    const orbitRadius = DISC_RADIUS * (0.35 + noise(seed, 17) * 0.55);
    const plane = 0.35 + noise(seed, 31) * 0.55;
    const phase = noise(seed, 53) * TAU;
    const omega = 0.1 + noise(seed, 23) * 0.16;
    const angle = angleOffset + t * omega + phase;

    const p = {
      x: center.x + Math.cos(angle) * orbitRadius,
      y: center.y + Math.sin(angle) * orbitRadius * plane,
    };

    const twinkle = (Math.sin(t * 1.3 + phase) * 0.5 + 0.5) * 0.42;
    const size = (1.6 + noise(seed, 23) * 1.8) * scale;
    const rNorm = orbitRadius / DISC_RADIUS;
    const colour = radialTint(pal, pal.armYoung, rNorm, 0.8);

    const projected = project(p);
    const glowSize = size * 1.8;
    painter.fillRectangle(
      { x: projected.x - glowSize * 0.5, y: projected.y - glowSize * 0.5 },
      { width: glowSize, height: glowSize },
      withAlpha(colour, 0.06 + twinkle * 0.1),
    );
    painter.fillRectangle(
      { x: projected.x - size * 0.5, y: projected.y - size * 0.5 },
      { width: size, height: size },
      withAlpha(colour, 0.18 + twinkle * 0.28),
    );
  }
}

function drawDisc(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const center = {
    x: LOGICAL_SIZE.width * 0.5,
    y: LOGICAL_SIZE.height * 0.5,
  };

  let placed = 0;
  let attempt = 0;
  const maxAttempts = DISC_STAR_COUNT * 14;

  while (placed < DISC_STAR_COUNT && attempt < maxAttempts) {
    const seed = 2400 + attempt;
    const nx = noise(seed, 3) * 2 - 1;
    const ny = noise(seed, 9) * 2 - 1;
    const r = Math.hypot(nx, ny);

    if (r < 0.04 || r > 1) {
      attempt++;
      continue;
    }

    const [density, armDistance] = armDensity(nx, ny, t);
    if (noise(seed, 15) > density) {
      attempt++;
      continue;
    }

    const rawX = center.x + nx * DISC_RADIUS;
    const rawY = center.y + ny * DISC_RADIUS * DISC_TILT;
    const phase = noise(seed, 53) * TAU;
    const driftX = Math.sin(t * 0.5 + phase) * 0.9;
    const driftY = Math.cos(t * 0.4 + phase * 1.3) * 0.6;
    const blockX = snap(rawX + driftX);
    const blockY = snap(rawY + driftY);
    const energy = Math.min(1, Math.max(0, density * (1 - armDistance * 0.4)));

    let baseColour: Rgba;
    if (energy > 0.7) {
      const hiiBlend = noise(seed, 97);
      baseColour =
        hiiBlend > 0.85
          ? blend(pal.armYoung, pal.hiiRegion, (hiiBlend - 0.85) * 6.67)
          : pal.armYoung;
    } else if (energy > 0.3) {
      const interm = (energy - 0.3) / 0.4;
      baseColour = blend(pal.armOld, pal.armYoung, interm);
    } else if (armDistance < 0.2) {
      baseColour = pal.dust;
    } else {
      baseColour = blend(pal.armOld, pal.dust, 0.3);
    }

    const colour = radialTint(pal, baseColour, r, 0.45);
    const shimmerPhase = noise(seed, 71) * TAU;
    const shimmer =
      (Math.sin(t * 1.4 + shimmerPhase) * 0.5 + 0.5) * (0.18 + energy * 0.18);
    const baseAlpha = 0.22 + energy * 0.65;
    const alpha = Math.min(1, Math.max(0.05, baseAlpha * (0.78 + shimmer)));
    const pulsePhase = noise(seed, 89) * TAU;
    const pulse = Math.sin(t * 1 + pulsePhase) * 0.5 + 0.5;
    const blockSize = Math.min(8, Math.max(2, 2.6 + energy * 4.2 + pulse * 0.7));

    const projected = project({ x: blockX, y: blockY });
    const size = blockSize * scale;
    painter.fillRectangle(
      { x: projected.x - size * 0.5, y: projected.y - size * 0.5 },
      { width: size, height: size },
      withAlpha(colour, alpha),
    );

    if (energy > 0.55) {
      const hiSize = Math.max(scale * 1.2, size * 0.32);
      const hot = blend(colour, WHITE, 0.55);
      painter.fillRectangle(
        {
          x: projected.x - size * 0.5 + hiSize * 0.4,
          y: projected.y - size * 0.5 + hiSize * 0.4,
        },
        { width: hiSize, height: hiSize },
        withAlpha(hot, Math.min(1, Math.max(0, alpha * 0.85))),
      );
    }

    placed++;
    attempt++;
  }
}

function drawArmSatellites(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const warm = pal.armYoung;
  const cool = pal.hiiRegion;
  const center = {
    x: LOGICAL_SIZE.width * 0.5,
    y: LOGICAL_SIZE.height * 0.5,
  };

  let placed = 0;
  let attempt = 0;
  const maxAttempts = ARM_SATELLITE_COUNT * 18;

  while (placed < ARM_SATELLITE_COUNT && attempt < maxAttempts) {
    const seed = 5500 + attempt;
    const r = 0.18 + noise(seed, 3) ** 0.8 * 0.78;
    const armIndex = Math.floor(noise(seed, 7) * ARM_COUNT);
    const armJitter = (noise(seed, 11) - 0.5) * ARM_WIDTH * 0.6;
    const omega = 0.18 / (0.4 + r);
    const thetaArm =
      ARM_PITCH * Math.log(1 + r * 6) +
      (armIndex * TAU) / ARM_COUNT +
      armJitter -
      t * omega;

    const nx = r * Math.cos(thetaArm);
    const ny = r * Math.sin(thetaArm);
    const rawX = center.x + nx * DISC_RADIUS;
    const rawY = center.y + ny * DISC_RADIUS * DISC_TILT;
    const phase = noise(seed, 29) * TAU;
    const twinkle = (Math.sin(t * 1.3 + phase) * 0.5 + 0.5) * 0.55;
    const baseColour = noise(seed, 83) > 0.75 ? cool : warm;
    const colour = radialTint(pal, baseColour, r, 0.6);
    const alpha = Math.min(1, Math.max(0, 0.3 + twinkle * 0.45));
    const size = (2.2 + (1 - r) * 2) * scale;

    const projected = project({ x: snap(rawX), y: snap(rawY) });
    const glowSize = size * 1.7;
    painter.fillRectangle(
      { x: projected.x - glowSize * 0.5, y: projected.y - glowSize * 0.5 },
      { width: glowSize, height: glowSize },
      withAlpha(colour, alpha * 0.3),
    );
    painter.fillRectangle(
      { x: projected.x - size * 0.5, y: projected.y - size * 0.5 },
      { width: size, height: size },
      withAlpha(colour, alpha),
    );

    placed++;
    attempt++;
  }
}

function drawBulge(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const warm = pal.bulge;
  const center = {
    x: LOGICAL_SIZE.width * 0.5,
    y: LOGICAL_SIZE.height * 0.5,
  };
  const breath = Math.sin(t * 0.6) * 0.5 + 0.5;
  const breathAlpha = 0.55 + breath * 0.3;

  let placed = 0;
  let attempt = 0;
  const maxAttempts = BULGE_BLOCK_COUNT * 16;

  while (placed < BULGE_BLOCK_COUNT && attempt < maxAttempts) {
    const seed = 6200 + attempt;
    const nx = noise(seed, 3) * 2 - 1;
    const ny = noise(seed, 9) * 2 - 1;
    const density = gaussian2d(nx, ny, 0.3, 0.24);

    if (noise(seed, 15) > density) {
      attempt++;
      continue;
    }

    const r = Math.hypot(nx, ny);
    const phase = noise(seed, 53) * TAU;
    const driftX = Math.sin(t * 0.7 + phase) * 0.7;
    const driftY = Math.cos(t * 0.5 + phase * 1.3) * 0.5;
    const rawX = center.x + nx * 38 + driftX;
    const rawY = center.y + ny * 32 + driftY;
    const blockX = snap(rawX);
    const blockY = snap(rawY);
    const rNorm = r / 0.38;
    const tinted = radialTint(pal, warm, rNorm, 0.7);
    const hot = blend(tinted, WHITE, Math.min(0.6, Math.max(0, 1 - r * 1.3)));
    const shimmerPhase = noise(seed, 71) * TAU;
    const shimmer = Math.sin(t * 1.6 + shimmerPhase) * 0.5 + 0.5;
    const alpha = Math.min(0.95, Math.max(0.06, breathAlpha * density * (0.7 + shimmer * 0.3)));
    const size = (2.4 + density * 3.4) * scale;

    const projected = project({ x: blockX, y: blockY });
    painter.fillRectangle(
      { x: projected.x - size * 0.5, y: projected.y - size * 0.5 },
      { width: size, height: size },
      withAlpha(hot, alpha),
    );
    placed++;
    attempt++;
  }
}

function drawNucleus(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const warm = pal.nucleus;
  const tinted = radialTint(pal, warm, 0.1, 0.85);
  const hot = blend(tinted, WHITE, 0.65);
  const center = {
    x: LOGICAL_SIZE.width * 0.5,
    y: LOGICAL_SIZE.height * 0.5,
  };
  const breath = Math.sin(t * 0.85) * 0.5 + 0.5;
  const breathAlpha = 0.65 + breath * 0.3;

  let placed = 0;
  let attempt = 0;
  const maxAttempts = NUCLEUS_BLOCK_COUNT * 16;

  while (placed < NUCLEUS_BLOCK_COUNT && attempt < maxAttempts) {
    const seed = 7700 + attempt;
    const nx = noise(seed, 3) * 2 - 1;
    const ny = noise(seed, 9) * 2 - 1;
    const density = gaussian2d(nx, ny, 0.16, 0.14);

    if (noise(seed, 15) < density) {
      const phase = noise(seed, 53) * TAU;
      const driftX = Math.sin(t * 0.9 + phase) * 0.6;
      const driftY = Math.cos(t * 0.7 + phase * 1.3) * 0.5;
      const rawX = center.x + nx * 18 + driftX;
      const rawY = center.y + ny * 14 + driftY;
      const shimmerPhase = noise(seed, 71) * TAU;
      const shimmer = Math.sin(t * 2.4 + shimmerPhase) * 0.5 + 0.5;
      const alpha = Math.min(1, Math.max(0.2, breathAlpha * (0.7 + shimmer * 0.3)));
      const size = (2.4 + density * 3) * scale;

      const projected = project({ x: snap(rawX), y: snap(rawY) });
      painter.fillRectangle(
        { x: projected.x - size * 0.5, y: projected.y - size * 0.5 },
        { width: size, height: size },
        withAlpha(hot, alpha),
      );
      placed++;
    }
    attempt++;
  }
}

function drawScanline(
  painter: SurfacePainter,
  pal: GalaxyPalette,
  t: number,
  scale: number,
  project: (p: Point2) => Point2,
): void {
  const accent = pal.core;
  const cycle = 8;
  const phase = Math.min(1, Math.max(0, t / cycle - Math.floor(t / cycle)));
  const bandY = phase * LOGICAL_SIZE.height;
  const cols = 60;

  for (let c = 0; c < cols; c++) {
    const fx = c / (cols - 1);
    const x = fx * LOGICAL_SIZE.width;
    const jitter = (noise(c, 3) - 0.5) * 1.2;
    const p = project({ x: snap(x), y: snap(bandY + jitter) });
    const edge = Math.min(1, Math.max(0, 1 - Math.abs(fx - 0.5) * 1.8));
    const alpha = 0.06 * edge;
    const size = scale * 1.6;

    painter.fillRectangle(
      { x: p.x - size * 0.5, y: p.y - size * 0.5 },
      { width: size, height: size },
      withAlpha(accent, alpha),
    );
  }
}

function armDensity(x: number, y: number, t: number): [number, number] {
  const r = Math.hypot(x, y);
  if (r < 1e-3) return [0, 0];

  const theta = Math.atan2(y, x);
  const omega = 0.18 / (0.4 + r);
  const thetaR = theta + t * omega;
  const armPhase = thetaR - ARM_PITCH * Math.log(1 + r * 6);
  const armN = ARM_COUNT;
  const wrapped = wrapPi(armPhase * armN) / armN;
  const armDistance = Math.min(
    1,
    Math.max(0, Math.abs(wrapped) / (Math.PI / armN)),
  );
  const armStrength = Math.exp(-((wrapped / ARM_WIDTH) ** 2) * 4);
  const envelope =
    Math.exp(-(((r - 0.55) / 0.32) ** 2)) * 0.85 +
    (Math.max(0, 1 - r) ** 2) * 0.25;
  const density = Math.min(1, Math.max(0, armStrength * envelope));
  return [density, armDistance];
}

function wrapPi(angle: number): number {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
}

function gaussian2d(x: number, y: number, sigmaX: number, sigmaY: number): number {
  return Math.exp(-0.5 * ((x / sigmaX) ** 2 + (y / sigmaY) ** 2));
}

function noise(value: number, seed: number): number {
  const mixed = Math.sin(value * 12.9898 + seed * 78.233) * 43758.547;
  return mixed - Math.floor(mixed);
}

function snap(value: number): number {
  return Math.round(value / SNAP_GRID) * SNAP_GRID;
}
