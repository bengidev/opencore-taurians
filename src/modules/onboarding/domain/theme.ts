export type ThemeMode = "light" | "dark";

export type BackgroundToken = "primary" | "secondary" | "tertiary";
export type ForegroundToken = "primary" | "secondary" | "muted" | "accent";
export type BorderToken = "default" | "strong";
export type ActionToken = "strong" | "strongText";

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function rgb(r: number, g: number, b: number, a = 1): RgbaColor {
  return { r, g, b, a };
}

const FOREGROUND: Record<ThemeMode, Record<ForegroundToken, RgbaColor>> = {
  light: {
    primary: rgb(0.04, 0.04, 0.04),
    secondary: rgb(0.32, 0.32, 0.32),
    muted: rgb(0.64, 0.64, 0.64),
    accent: rgb(0.09, 0.09, 0.09),
  },
  dark: {
    primary: rgb(0.98, 0.98, 0.98),
    secondary: rgb(0.64, 0.64, 0.64),
    muted: rgb(0.45, 0.45, 0.45),
    accent: rgb(0.9, 0.9, 0.9),
  },
};

const SURFACE: Record<ThemeMode, Record<BackgroundToken, RgbaColor>> = {
  light: {
    primary: rgb(0.98, 0.98, 0.98),
    secondary: rgb(0.96, 0.96, 0.96),
    tertiary: rgb(0.94, 0.94, 0.94),
  },
  dark: {
    primary: rgb(0, 0, 0),
    secondary: rgb(0.04, 0.04, 0.04),
    tertiary: rgb(0.1, 0.1, 0.1),
  },
};

const BORDER: Record<ThemeMode, Record<BorderToken, RgbaColor>> = {
  light: {
    default: rgb(0.9, 0.9, 0.9),
    strong: rgb(0.83, 0.83, 0.83),
  },
  dark: {
    default: rgb(0.15, 0.15, 0.15),
    strong: rgb(0.25, 0.25, 0.25),
  },
};

const ACTION: Record<ThemeMode, Record<ActionToken, RgbaColor>> = {
  light: {
    strong: rgb(0.04, 0.04, 0.04),
    strongText: rgb(0.98, 0.98, 0.98),
  },
  dark: {
    strong: rgb(0.98, 0.98, 0.98),
    strongText: rgb(0.04, 0.04, 0.04),
  },
};

export const CONTROL_RADIUS = 8;
export const DEFAULT_THEME_MODE: ThemeMode = "dark";

export function foreground(mode: ThemeMode, token: ForegroundToken): RgbaColor {
  return FOREGROUND[mode][token];
}

export function surface(mode: ThemeMode, token: BackgroundToken): RgbaColor {
  return SURFACE[mode][token];
}

export function borderToken(mode: ThemeMode, token: BorderToken): RgbaColor {
  return BORDER[mode][token];
}

export function action(mode: ThemeMode, token: ActionToken): RgbaColor {
  return ACTION[mode][token];
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return mode === "dark" ? "light" : "dark";
}

function toCss({ r, g, b, a }: RgbaColor): string {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  return a < 1 ? `rgba(${ri}, ${gi}, ${bi}, ${a})` : `rgb(${ri}, ${gi}, ${bi})`;
}

function cssVarName(
  category: "fg" | "bg" | "border" | "action",
  token: string,
): string {
  return `--oc-${category}-${token}`;
}

export function applyThemeToDocument(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;

  for (const [token, color] of Object.entries(FOREGROUND[mode])) {
    root.style.setProperty(cssVarName("fg", token), toCss(color));
  }
  for (const [token, color] of Object.entries(SURFACE[mode])) {
    root.style.setProperty(cssVarName("bg", token), toCss(color));
  }
  for (const [token, color] of Object.entries(BORDER[mode])) {
    root.style.setProperty(cssVarName("border", token), toCss(color));
  }
  for (const [token, color] of Object.entries(ACTION[mode])) {
    root.style.setProperty(cssVarName("action", token), toCss(color));
  }
}
