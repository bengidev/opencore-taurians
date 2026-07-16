import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useChatStore } from "../../chat/state/chatStore";
import { useProjectStore } from "./projectStore";
import { appendTrunkMessage } from "./projectChat";

describe("appendTrunkMessage", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useChatStore.getState().resetChat();
  });

  it("appendTrunkMessage stores chat and touches activity", () => {
    const { project, trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    appendTrunkMessage({
      trunkId: trunk.id,
      role: "user",
      content: "hello",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    expect(useChatStore.getState().listMessages(trunk.id)[0]?.content).toBe("hello");
    expect(
      useProjectStore.getState().projects.find((p) => p.id === project.id)?.lastOpenedAt,
    ).toBe("2026-07-10T00:00:00.000Z");
  });
});
