import { DEFAULT_THEME_MODE, type ThemeMode } from "../domain/onboardingTheme";

export interface ThemeRepository {
  load(): ThemeMode;
  save(mode: ThemeMode): void;
}

export const THEME_STORAGE_KEY = "opencore-theme";

export class LocalStorageThemeRepository implements ThemeRepository {
  constructor(private readonly storageKey = THEME_STORAGE_KEY) {}

  load(): ThemeMode {
    const stored = localStorage.getItem(this.storageKey);
    if (stored === "light" || stored === "dark") return stored;
    return DEFAULT_THEME_MODE;
  }

  save(mode: ThemeMode): void {
    localStorage.setItem(this.storageKey, mode);
  }
}

export const defaultThemeRepository = new LocalStorageThemeRepository();
