import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";
import type { ChatMessage, ChatRole, ChatSearchHit } from "../domain/chatTypes";

export interface ChatState {
  messagesByChunkId: Record<string, ChatMessage[]>;
  appendMessage: (input: {
    chunkId: string;
    role: ChatRole;
    content: string;
    createdAt: string;
    id?: string;
  }) => ChatMessage;
  listMessages: (chunkId: string) => ChatMessage[];
  searchMessages: (query: string) => ChatSearchHit[];
  deleteByChunkIds: (chunkIds: string[]) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesByChunkId: {},
      appendMessage: (input) => {
        const message: ChatMessage = {
          id: input.id ?? crypto.randomUUID(),
          chunkId: input.chunkId,
          role: input.role,
          content: input.content,
          createdAt: input.createdAt,
        };
        set((state) => {
          const existing = state.messagesByChunkId[input.chunkId] ?? [];
          return {
            messagesByChunkId: {
              ...state.messagesByChunkId,
              [input.chunkId]: [...existing, message],
            },
          };
        });
        return message;
      },
      listMessages: (chunkId) => get().messagesByChunkId[chunkId] ?? [],
      searchMessages: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const hits: ChatSearchHit[] = [];
        for (const [chunkId, messages] of Object.entries(get().messagesByChunkId)) {
          for (const message of messages) {
            if (!message.content.toLowerCase().includes(q)) continue;
            hits.push({
              chunkId,
              messageId: message.id,
              snippet: message.content.slice(0, 120),
            });
          }
        }
        return hits;
      },
      deleteByChunkIds: (chunkIds) => {
        const remove = new Set(chunkIds);
        set((state) => {
          const next: Record<string, ChatMessage[]> = {};
          for (const [chunkId, messages] of Object.entries(state.messagesByChunkId)) {
            if (!remove.has(chunkId)) next[chunkId] = messages;
          }
          return { messagesByChunkId: next };
        });
      },
      resetChat: () => set({ messagesByChunkId: {} }),
    }),
    {
      name: SESSION_PERSIST_KEYS.chat,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({ messagesByChunkId: state.messagesByChunkId }),
    },
  ),
);
