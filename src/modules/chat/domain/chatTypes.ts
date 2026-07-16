export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  trunkId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSearchHit {
  trunkId: string;
  messageId: string;
  snippet: string;
}
