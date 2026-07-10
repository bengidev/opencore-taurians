import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "./shellStore";

describe("shellStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
    });
  });

  it("setActiveMainCard switches cards", () => {
    useShellStore.getState().setActiveMainCard("editor");
    expect(useShellStore.getState().activeMainCard).toBe("editor");
  });

  it("toggles left and right independently", () => {
    useShellStore.getState().toggleLeft();
    expect(useShellStore.getState().leftVisible).toBe(false);
    expect(useShellStore.getState().rightVisible).toBe(true);
    useShellStore.getState().toggleRight();
    expect(useShellStore.getState().rightVisible).toBe(false);
  });
});
