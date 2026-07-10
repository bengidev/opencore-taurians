import { useChatStore } from "../../chat/state/chatStore";
import type { ChatRole } from "../../chat/domain/chatTypes";
import { useProjectStore } from "./projectStore";

export function appendChunkMessage(input: {
  chunkId: string;
  role: ChatRole;
  content: string;
  nowIso: string;
}) {
  const message = useChatStore.getState().appendMessage({
    chunkId: input.chunkId,
    role: input.role,
    content: input.content,
    createdAt: input.nowIso,
  });
  useProjectStore.getState().touchChunkActivity(input.chunkId, input.nowIso);
  return message;
}
