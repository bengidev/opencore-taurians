import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getSessionStateStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";

export type ShellMainCard = "chat" | "terminal" | "editor";

export interface ShellState {
  activeMainCard: ShellMainCard;
  leftVisible: boolean;
  rightVisible: boolean;
  setActiveMainCard: (card: ShellMainCard) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  resetShellUi: () => void;
}

const DEFAULT_SHELL_UI = {
  activeMainCard: "chat" as ShellMainCard,
  leftVisible: true,
  rightVisible: true,
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      ...DEFAULT_SHELL_UI,
      setActiveMainCard: (card) => set({ activeMainCard: card }),
      toggleLeft: () => set((s) => ({ leftVisible: !s.leftVisible })),
      toggleRight: () => set((s) => ({ rightVisible: !s.rightVisible })),
      resetShellUi: () => set({ ...DEFAULT_SHELL_UI }),
    }),
    {
      name: SESSION_PERSIST_KEYS.shell,
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({
        activeMainCard: state.activeMainCard,
        leftVisible: state.leftVisible,
        rightVisible: state.rightVisible,
      }),
    },
  ),
);
