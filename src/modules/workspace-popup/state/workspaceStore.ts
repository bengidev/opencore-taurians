import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getSessionStateStorage } from "../../session/infrastructure/sessionPersistStorage";
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
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({ workspacePath: state.workspacePath }),
    },
  ),
);
