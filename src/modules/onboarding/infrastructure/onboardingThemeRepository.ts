import { DEFAULT_THEME_MODE, type ThemeMode } from "../domain/onboardingTheme";
import { THEME_STORAGE_KEY } from "./onboardingThemeConstants";

export type { ThemeMode };
export { THEME_STORAGE_KEY };

export interface ThemeRepository {
  load(): ThemeMode;
  save(mode: ThemeMode): void;
}

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
