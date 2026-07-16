import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";
import type { ChatMessage, ChatRole, ChatSearchHit } from "../domain/chatTypes";

export interface ChatState {
  messagesByTrunkId: Record<string, ChatMessage[]>;
  appendMessage: (input: {
    trunkId: string;
    role: ChatRole;
    content: string;
    createdAt: string;
    id?: string;
  }) => ChatMessage;
  listMessages: (trunkId: string) => ChatMessage[];
  searchMessages: (query: string) => ChatSearchHit[];
  deleteByTrunkIds: (trunkIds: string[]) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesByTrunkId: {},
      appendMessage: (input) => {
        const message: ChatMessage = {
          id: input.id ?? crypto.randomUUID(),
          trunkId: input.trunkId,
          role: input.role,
          content: input.content,
          createdAt: input.createdAt,
        };
        set((state) => {
          const existing = state.messagesByTrunkId[input.trunkId] ?? [];
          return {
            messagesByTrunkId: {
              ...state.messagesByTrunkId,
              [input.trunkId]: [...existing, message],
            },
          };
        });
        return message;
      },
      listMessages: (trunkId) => get().messagesByTrunkId[trunkId] ?? [],
      searchMessages: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const hits: ChatSearchHit[] = [];
        for (const [trunkId, messages] of Object.entries(get().messagesByTrunkId)) {
          for (const message of messages) {
            if (!message.content.toLowerCase().includes(q)) continue;
            hits.push({
              trunkId,
              messageId: message.id,
              snippet: message.content.slice(0, 120),
            });
          }
        }
        return hits;
      },
      deleteByTrunkIds: (trunkIds) => {
        const remove = new Set(trunkIds);
        set((state) => {
          const next: Record<string, ChatMessage[]> = {};
          for (const [trunkId, messages] of Object.entries(state.messagesByTrunkId)) {
            if (!remove.has(trunkId)) next[trunkId] = messages;
          }
          return { messagesByTrunkId: next };
        });
      },
      resetChat: () => set({ messagesByTrunkId: {} }),
    }),
    {
      name: SESSION_PERSIST_KEYS.chat,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({ messagesByTrunkId: state.messagesByTrunkId }),
    },
  ),
);
