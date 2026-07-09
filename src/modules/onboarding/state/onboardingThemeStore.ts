import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  applyThemeToDocument,
  DEFAULT_THEME_MODE,
  nextThemeMode,
  type ThemeMode,
} from "../domain/onboardingTheme";
import { THEME_STORAGE_KEY } from "../infrastructure/onboardingThemeConstants";
import { getSessionStateStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";

function mirrorLocalStorage(mode: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  applyThemeToDocument(mode);
}

export interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  resetTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: DEFAULT_THEME_MODE,
      setMode: (mode) => {
        mirrorLocalStorage(mode);
        set({ mode });
      },
      toggle: () => {
        const mode = nextThemeMode(get().mode);
        mirrorLocalStorage(mode);
        set({ mode });
      },
      resetTheme: () => {
        mirrorLocalStorage(DEFAULT_THEME_MODE);
        set({ mode: DEFAULT_THEME_MODE });
      },
    }),
    {
      name: SESSION_PERSIST_KEYS.theme,
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) mirrorLocalStorage(state.mode);
      },
    },
  ),
);
