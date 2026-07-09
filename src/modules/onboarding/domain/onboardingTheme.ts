export type ThemeMode = "light" | "dark";

export type BackgroundToken = "primary" | "secondary" | "tertiary";
export type ForegroundToken = "primary" | "secondary" | "muted" | "accent";
export type BorderToken = "default" | "strong";
export type ActionToken = "strong" | "strongText";

/** Normalized RGBA (0–1 channels). Canvas palette mirrors design-system/tokens.css. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function rgb(r: number, g: number, b: number, a = 1): Rgba {
  return { r, g, b, a };
}

const INK = rgb(0, 0, 0);
const INK_DEEP = rgb(0, 0, 0);
const PAPER = rgb(245 / 255, 245 / 255, 245 / 255);
const PAPER_MUTED = rgb(1, 1, 1);
const SURFACE_RAISED_LIGHT = rgb(240 / 255, 240 / 255, 240 / 255);
const SURFACE_DARK = rgb(17 / 255, 17 / 255, 17 / 255);
const SURFACE_RAISED_DARK = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_DISPLAY_DARK = rgb(1, 1, 1);
const TEXT_PRIMARY_DARK = rgb(232 / 255, 232 / 255, 232 / 255);
const TEXT_DISPLAY_LIGHT = rgb(0, 0, 0);
const TEXT_PRIMARY_LIGHT = rgb(26 / 255, 26 / 255, 26 / 255);
const TEXT_SECONDARY_DARK = rgb(153 / 255, 153 / 255, 153 / 255);
const TEXT_SECONDARY_LIGHT = rgb(102 / 255, 102 / 255, 102 / 255);
const TEXT_DISABLED_DARK = rgb(102 / 255, 102 / 255, 102 / 255);
const TEXT_DISABLED_LIGHT = rgb(153 / 255, 153 / 255, 153 / 255);
const BORDER_LIGHT = rgb(232 / 255, 232 / 255, 232 / 255);
const BORDER_LIGHT_STRONG = rgb(204 / 255, 204 / 255, 204 / 255);
const BORDER_DARK = rgb(34 / 255, 34 / 255, 34 / 255);
const BORDER_DARK_STRONG = rgb(51 / 255, 51 / 255, 51 / 255);

const FOREGROUND: Record<ThemeMode, Record<ForegroundToken, Rgba>> = {
  light: {
    primary: TEXT_PRIMARY_LIGHT,
    secondary: TEXT_SECONDARY_LIGHT,
    muted: TEXT_DISABLED_LIGHT,
    accent: TEXT_DISPLAY_LIGHT,
  },
  dark: {
    primary: TEXT_PRIMARY_DARK,
    secondary: TEXT_SECONDARY_DARK,
    muted: TEXT_DISABLED_DARK,
    accent: TEXT_DISPLAY_DARK,
  },
};

const SURFACE: Record<ThemeMode, Record<BackgroundToken, Rgba>> = {
  light: {
    primary: PAPER,
    secondary: PAPER_MUTED,
    tertiary: SURFACE_RAISED_LIGHT,
  },
  dark: {
    primary: INK_DEEP,
    secondary: SURFACE_DARK,
    tertiary: SURFACE_RAISED_DARK,
  },
};

const BORDER: Record<ThemeMode, Record<BorderToken, Rgba>> = {
  light: {
    default: BORDER_LIGHT,
    strong: BORDER_LIGHT_STRONG,
  },
  dark: {
    default: BORDER_DARK,
    strong: BORDER_DARK_STRONG,
  },
};

const ACTION: Record<ThemeMode, Record<ActionToken, Rgba>> = {
  light: {
    strong: INK,
    strongText: PAPER_MUTED,
  },
  dark: {
    strong: TEXT_DISPLAY_DARK,
    strongText: INK,
  },
};

export const DEFAULT_THEME_MODE: ThemeMode = "dark";

export function foreground(mode: ThemeMode, token: ForegroundToken): Rgba {
  return FOREGROUND[mode][token];
}

export function surface(mode: ThemeMode, token: BackgroundToken): Rgba {
  return SURFACE[mode][token];
}

export function borderToken(mode: ThemeMode, token: BorderToken): Rgba {
  return BORDER[mode][token];
}

export function action(mode: ThemeMode, token: ActionToken): Rgba {
  return ACTION[mode][token];
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === "dark" ? "light" : "dark";
}

export function rgbaToCss({ r, g, b, a }: Rgba): string {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  return a < 1 ? `rgba(${ri}, ${gi}, ${bi}, ${a})` : `rgb(${ri}, ${gi}, ${bi})`;
}

/** Applies Tailwind/shadcn dark-mode class before React hydrates theme state. */
export function applyThemeToDocument(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.toggle("dark", mode === "dark");
}
