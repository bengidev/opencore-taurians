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

function createDefaultEntry(trunkId: string, status: TerminalSessionStatus = "idle"): TerminalSessionEntry {
  return { trunkId, info: null, status, error: null, pendingMessages: [] };
}

/**
 * Returns the existing entry for `trunkId`, or a complete default entry with
 * the given `status`. Every setter must be able to run before `ensureSession`
 * (e.g. the appendPendingMessage buffer-before-ready path), so a missing key
 * never leaves a partial entry behind.
 */
function getEntry(
  sessions: Record<string, TerminalSessionEntry>,
  trunkId: string,
  status: TerminalSessionStatus,
): TerminalSessionEntry {
  return sessions[trunkId] ?? createDefaultEntry(trunkId, status);
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessionsByTrunkId: {},

  ensureSession(trunkId) {
    set((state) => {
      if (state.sessionsByTrunkId[trunkId]) return state;
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: createDefaultEntry(trunkId),
        },
      };
    });
  },

  setSpawning(trunkId) {
    set((state) => {
      const entry = getEntry(state.sessionsByTrunkId, trunkId, "spawning");
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: { ...entry, status: "spawning", error: null },
        },
      };
    });
  },

  setReady(trunkId, info) {
    set((state) => {
      const entry = getEntry(state.sessionsByTrunkId, trunkId, "ready");
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: { ...entry, info, status: "ready", error: null },
        },
      };
    });
  },

  setError(trunkId, error) {
    set((state) => {
      const entry = getEntry(state.sessionsByTrunkId, trunkId, "error");
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: { ...entry, status: "error", error },
        },
      };
    });
  },

  setExited(trunkId, exitCode) {
    set((state) => {
      const entry = getEntry(state.sessionsByTrunkId, trunkId, "exited");
      const error = exitCode != null && exitCode !== 0 ? `Process exited with code ${exitCode}` : null;
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: { ...entry, status: "exited", error },
        },
      };
    });
  },

  appendPendingMessage(trunkId, message) {
    set((state) => {
      const entry = getEntry(state.sessionsByTrunkId, trunkId, "idle");
      const MAX_PENDING_CHUNKS = 2000;
      const next =
        entry.pendingMessages.length >= MAX_PENDING_CHUNKS
          ? [...entry.pendingMessages.slice(1), message]
          : [...entry.pendingMessages, message];
      return {
        sessionsByTrunkId: {
          ...state.sessionsByTrunkId,
          [trunkId]: { ...entry, pendingMessages: next },
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
