import type { ITheme } from "@xterm/xterm";
import type { ThemeMode } from "../../onboarding/state/onboardingThemeStore";

const LIGHT_TERMINAL_THEME: ITheme = {
  background: "#f5f5f5",
  foreground: "#1a1a1a",
  cursor: "#1a1a1a",
  selectionBackground: "#ffffff",
};

const DARK_TERMINAL_THEME: ITheme = {
  background: "#000000",
  foreground: "#e8e8e8",
  cursor: "#e8e8e8",
  selectionBackground: "#333333",
};

export function getTerminalTheme(mode: ThemeMode): ITheme {
  return mode === "dark" ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME;
}
