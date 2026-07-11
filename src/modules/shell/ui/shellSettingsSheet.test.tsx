import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { DEFAULT_SHELL_PANEL_WIDTH } from "../state/shellPanelSizing";
import { useShellStore } from "../state/shellStore";
import { ShellBottomPanel } from "./panels/shellBottomPanel";

describe("ShellSettingsSheet", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      leftVisible: true,
      rightVisible: false,
      leftPanelWidth: 320,
      rightPanelWidth: 320,
    });
    useThemeStore.setState({ mode: "dark" });
  });

  it("opens settings sheet from bottom panel", async () => {
    const user = userEvent.setup();
    render(<ShellBottomPanel />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("switches theme from the sheet", async () => {
    const user = userEvent.setup();
    render(<ShellBottomPanel />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(useThemeStore.getState().mode).toBe("light");
  });

  it("updates panel visibility and resets widths", async () => {
    const user = userEvent.setup();
    render(<ShellBottomPanel />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("switch", { name: "Show right panel" }));
    expect(useShellStore.getState().rightVisible).toBe(true);
    await user.click(screen.getByRole("button", { name: "Reset panel widths" }));
    expect(useShellStore.getState().leftPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
    expect(useShellStore.getState().rightPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
  });
});
