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

const INK = rgb(31 / 255, 31 / 255, 31 / 255);
const INK_DEEP = rgb(16 / 255, 16 / 255, 16 / 255);
const PAPER = rgb(1, 1, 1);
const PAPER_MUTED = rgb(250 / 255, 250 / 255, 250 / 255);
const GRAY_400 = rgb(163 / 255, 163 / 255, 163 / 255);
const GRAY_500 = rgb(115 / 255, 115 / 255, 115 / 255);
const GRAY_600 = rgb(82 / 255, 82 / 255, 82 / 255);
const GRAY_700 = rgb(64 / 255, 64 / 255, 64 / 255);
const GRAY_200 = rgb(229 / 255, 229 / 255, 229 / 255);
const GRAY_300 = rgb(212 / 255, 212 / 255, 212 / 255);

const FOREGROUND: Record<ThemeMode, Record<ForegroundToken, Rgba>> = {
  light: {
    primary: INK_DEEP,
    secondary: GRAY_600,
    muted: GRAY_500,
    accent: INK,
  },
  dark: {
    primary: PAPER,
    secondary: GRAY_400,
    muted: GRAY_500,
    accent: PAPER_MUTED,
  },
};

const SURFACE: Record<ThemeMode, Record<BackgroundToken, Rgba>> = {
  light: {
    primary: PAPER,
    secondary: PAPER_MUTED,
    tertiary: GRAY_200,
  },
  dark: {
    primary: INK_DEEP,
    secondary: INK,
    tertiary: GRAY_700,
  },
};

const BORDER: Record<ThemeMode, Record<BorderToken, Rgba>> = {
  light: {
    default: GRAY_200,
    strong: GRAY_300,
  },
  dark: {
    default: GRAY_700,
    strong: GRAY_600,
  },
};

const ACTION: Record<ThemeMode, Record<ActionToken, Rgba>> = {
  light: {
    strong: INK_DEEP,
    strongText: PAPER,
  },
  dark: {
    strong: PAPER,
    strongText: INK_DEEP,
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
