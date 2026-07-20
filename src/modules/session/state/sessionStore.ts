import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSessionPersistStorage } from "../infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../infrastructure/sessionPersistKeys";
import {
  GUI_SCALE_DEFAULT,
  clampGuiScale,
} from "../domain/sessionGuiScale";

export interface SessionState {
  onboardingCompleted: boolean;
  hasHydrated: boolean;
  guiScale: number;
  completeOnboarding: () => void;
  resetSessionFlags: () => void;
  setHasHydrated: (value: boolean) => void;
  setGuiScale: (scale: number) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      hasHydrated: false,
      guiScale: GUI_SCALE_DEFAULT,
      completeOnboarding: () => set({ onboardingCompleted: true }),
      resetSessionFlags: () =>
        set({ onboardingCompleted: false, guiScale: GUI_SCALE_DEFAULT }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setGuiScale: (scale) => set({ guiScale: clampGuiScale(scale) }),
    }),
    {
      name: SESSION_PERSIST_KEYS.session,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
        guiScale: state.guiScale,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SessionState> | undefined;
        return {
          ...current,
          ...p,
          guiScale: clampGuiScale(p?.guiScale ?? current.guiScale),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
