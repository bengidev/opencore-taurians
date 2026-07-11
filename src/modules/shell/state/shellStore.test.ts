import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { DEFAULT_SHELL_PANEL_WIDTH } from "./shellPanelSizing";
import { useShellStore } from "./shellStore";

describe("shellStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
      bottomVisible: true,
      leftPanelWidth: 300,
      rightPanelWidth: 300,
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

  it("setLeftVisible sets visibility without toggling", () => {
    useShellStore.getState().setLeftVisible(false);
    expect(useShellStore.getState().leftVisible).toBe(false);
    useShellStore.getState().setLeftVisible(true);
    expect(useShellStore.getState().leftVisible).toBe(true);
  });

  it("setRightVisible sets visibility without toggling", () => {
    useShellStore.getState().setRightVisible(false);
    expect(useShellStore.getState().rightVisible).toBe(false);
  });

  it("setBottomVisible sets bottom panel visibility", () => {
    useShellStore.getState().setBottomVisible(false);
    expect(useShellStore.getState().bottomVisible).toBe(false);
    useShellStore.getState().setBottomVisible(true);
    expect(useShellStore.getState().bottomVisible).toBe(true);
  });

  it("resetPanelWidths restores defaults without touching visibility or main card", () => {
    useShellStore.setState({
      activeMainCard: "editor",
      leftVisible: false,
      rightVisible: true,
      bottomVisible: false,
      leftPanelWidth: 400,
      rightPanelWidth: 350,
    });
    useShellStore.getState().resetPanelWidths();
    const state = useShellStore.getState();
    expect(state.leftPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
    expect(state.rightPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
    expect(state.leftVisible).toBe(false);
    expect(state.bottomVisible).toBe(false);
    expect(state.activeMainCard).toBe("editor");
  });
});
