import { useChatStore } from "../../chat/state/chatStore";
import type { ChatRole } from "../../chat/domain/chatTypes";
import { useProjectStore } from "./projectStore";

export function appendTrunkMessage(input: {
  trunkId: string;
  role: ChatRole;
  content: string;
  nowIso: string;
}) {
  const message = useChatStore.getState().appendMessage({
    trunkId: input.trunkId,
    role: input.role,
    content: input.content,
    createdAt: input.nowIso,
  });
  useProjectStore.getState().touchTrunkActivity(input.trunkId, input.nowIso);
  return message;
}
