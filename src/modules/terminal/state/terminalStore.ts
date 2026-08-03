import { create } from "zustand";
import type { TerminalSessionInfo, TerminalChannelMessage } from "../api/terminalContracts";

export type TerminalSessionStatus = "idle" | "spawning" | "ready" | "error" | "exited";

export interface TerminalSessionEntry {
  trunkId: string;
  info: TerminalSessionInfo | null;
  status: TerminalSessionStatus;
  error: string | null;
  pendingMessages: TerminalChannelMessage[];
}

export interface TerminalState {
  sessionsByTrunkId: Record<string, TerminalSessionEntry>;
  ensureSession(trunkId: string): void;
  setSpawning(trunkId: string): void;
  setReady(trunkId: string, info: TerminalSessionInfo): void;
  setError(trunkId: string, error: string): void;
  setExited(trunkId: string, exitCode: number | null): void;
  appendPendingMessage(trunkId: string, message: TerminalChannelMessage): void;
  drainPendingMessages(trunkId: string): TerminalChannelMessage[];
  killSession(trunkId: string): void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessionsByTrunkId: {},

  ensureSession(trunkId) {
    set((state) => {
      if (state.sessionsByTrunkId[trunkId]) return state;
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: {
            trunkId,
            info: null,
            status: "idle",
            error: null,
            pendingMessages: [],
          },
        },
      };
    });
  },

  setSpawning(trunkId) {
    set((state) => ({
      sessionsByTrunkId: {
        ...state.sessionsByTrunkId,
        [trunkId]: { ...state.sessionsByTrunkId[trunkId], status: "spawning", error: null },
      },
    }));
  },

  setReady(trunkId, info) {
    set((state) => ({
      sessionsByTrunkId: {
        ...state.sessionsByTrunkId,
        [trunkId]: { ...state.sessionsByTrunkId[trunkId], info, status: "ready", error: null },
      },
    }));
  },

  setError(trunkId, error) {
    set((state) => ({
      sessionsByTrunkId: {
        ...state.sessionsByTrunkId,
        [trunkId]: { ...state.sessionsByTrunkId[trunkId], status: "error", error },
      },
    }));
  },

  setExited(trunkId, exitCode) {
    set((state) => ({
      sessionsByTrunkId: {
        ...state.sessionsByTrunkId,
        [trunkId]: {
          ...state.sessionsByTrunkId[trunkId],
          status: "exited",
          error: exitCode != null ? `Process exited with code ${exitCode}` : "Process exited",
        },
      },
    }));
  },

  appendPendingMessage(trunkId, message) {
    set((state) => {
      const current = state.sessionsByTrunkId[trunkId]?.pendingMessages ?? [];
      const MAX_PENDING_CHUNKS = 2000;
      const next =
        current.length >= MAX_PENDING_CHUNKS
          ? [...current.slice(1), message]
          : [...current, message];
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: {
            ...state.sessionsByTrunkId[trunkId],
            pendingMessages: next,
          },
        },
      };
    });
  },

  drainPendingMessages(trunkId) {
    const entry = get().sessionsByTrunkId[trunkId];
    const messages = entry?.pendingMessages ?? [];
    if (messages.length > 0) {
      set((state) => ({
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: { ...state.sessionsByTrunkId[trunkId], pendingMessages: [] },
        },
      }));
    }
    return messages;
  },

  killSession(trunkId) {
    set((state) => {
      const { [trunkId]: _removed, ...rest } = state.sessionsByTrunkId;
      return { sessionsByTrunkId: rest };
    });
  },
}));
