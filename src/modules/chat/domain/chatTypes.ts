export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  chunkId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSearchHit {
  chunkId: string;
  messageId: string;
  snippet: string;
}
