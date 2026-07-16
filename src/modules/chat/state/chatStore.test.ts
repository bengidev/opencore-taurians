import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useChatStore } from "./chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useChatStore.setState({ messagesByTrunkId: {} });
  });

  it("appends messages per trunk in order", () => {
    const a = useChatStore.getState().appendMessage({
      trunkId: "c1",
      role: "user",
      content: "hi",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const b = useChatStore.getState().appendMessage({
      trunkId: "c1",
      role: "assistant",
      content: "hello",
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    expect(useChatStore.getState().listMessages("c1").map((m) => m.id)).toEqual([
      a.id,
      b.id,
    ]);
  });

  it("searches message bodies case-insensitively", () => {
    useChatStore.getState().appendMessage({
      trunkId: "c1",
      role: "user",
      content: "Fix the Login bug",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      trunkId: "c2",
      role: "user",
      content: "unrelated",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const hits = useChatStore.getState().searchMessages("login");
    expect(hits.map((h) => h.trunkId)).toEqual(["c1"]);
    expect(hits[0]?.snippet.toLowerCase()).toContain("login");
  });

  it("deleteByTrunkIds removes only those trunks", () => {
    useChatStore.getState().appendMessage({
      trunkId: "c1",
      role: "user",
      content: "a",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      trunkId: "c2",
      role: "user",
      content: "b",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().deleteByTrunkIds(["c1"]);
    expect(useChatStore.getState().listMessages("c1")).toEqual([]);
    expect(useChatStore.getState().listMessages("c2")).toHaveLength(1);
  });

  it("resetChat clears all messages", () => {
    useChatStore.getState().appendMessage({
      trunkId: "c1",
      role: "user",
      content: "a",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().resetChat();
    expect(useChatStore.getState().messagesByTrunkId).toEqual({});
  });
});
