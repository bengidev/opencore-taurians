import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";

export interface WorkspaceState {
  workspacePath: string | null;
  setWorkspace: (path: string) => void;
  clearWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspacePath: null,
      setWorkspace: (path) => set({ workspacePath: path }),
      clearWorkspace: () => set({ workspacePath: null }),
    }),
    {
      name: SESSION_PERSIST_KEYS.workspace,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({ workspacePath: state.workspacePath }),
    },
  ),
);
