import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";
import {
  clampShellPanelWidth,
  DEFAULT_SHELL_PANEL_WIDTH,
} from "./shellPanelSizing";

export type ShellMainCard = "chat" | "terminal" | "editor";

export interface ShellState {
  activeMainCard: ShellMainCard;
  leftVisible: boolean;
  rightVisible: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  setActiveMainCard: (card: ShellMainCard) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  resetShellUi: () => void;
}

const DEFAULT_SHELL_UI = {
  activeMainCard: "chat" as ShellMainCard,
  leftVisible: true,
  rightVisible: true,
  leftPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
  rightPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      ...DEFAULT_SHELL_UI,
      setActiveMainCard: (card) => set({ activeMainCard: card }),
      toggleLeft: () => set((s) => ({ leftVisible: !s.leftVisible })),
      toggleRight: () => set((s) => ({ rightVisible: !s.rightVisible })),
      setLeftPanelWidth: (width) =>
        set({ leftPanelWidth: clampShellPanelWidth(width) }),
      setRightPanelWidth: (width) =>
        set({ rightPanelWidth: clampShellPanelWidth(width) }),
      resetShellUi: () => set({ ...DEFAULT_SHELL_UI }),
    }),
    {
      name: SESSION_PERSIST_KEYS.shell,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({
        activeMainCard: state.activeMainCard,
        leftVisible: state.leftVisible,
        rightVisible: state.rightVisible,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
      }),
    },
  ),
);
