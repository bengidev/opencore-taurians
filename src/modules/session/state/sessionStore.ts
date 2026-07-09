import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getSessionStateStorage } from "../infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../infrastructure/sessionPersistKeys";

export interface SessionState {
  onboardingCompleted: boolean;
  hasHydrated: boolean;
  completeOnboarding: () => void;
  resetSessionFlags: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      hasHydrated: false,
      completeOnboarding: () => set({ onboardingCompleted: true }),
      resetSessionFlags: () => set({ onboardingCompleted: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: SESSION_PERSIST_KEYS.session,
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
