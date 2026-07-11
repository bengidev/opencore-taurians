import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { DEFAULT_SHELL_PANEL_WIDTH } from "../state/shellPanelSizing";
import { useShellStore } from "../state/shellStore";
import { ShellScreen } from "./shellScreen";

describe("ShellSettingsPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      leftVisible: true,
      rightVisible: false,
      bottomVisible: true,
      settingsOpen: false,
      leftPanelWidth: 320,
      rightPanelWidth: 320,
    });
    useThemeStore.setState({ mode: "dark" });
  });

  it("opens full-page settings from the left panel header", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toHaveTextContent("Settings");
  });

  it("switches theme from settings", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(useThemeStore.getState().mode).toBe("light");
  });

  it("updates panel visibility, bottom panel, and resets widths", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("switch", { name: "Show right panel" }));
    expect(useShellStore.getState().rightVisible).toBe(true);
    await user.click(screen.getByRole("switch", { name: "Show bottom panel" }));
    expect(useShellStore.getState().bottomVisible).toBe(false);
    await user.click(screen.getByRole("button", { name: "Reset panel widths" }));
    expect(useShellStore.getState().leftPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
    expect(useShellStore.getState().rightPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
  });

  it("closes settings when clicking the settings label in the header", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByText("Settings"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    });
  });

  it("closes settings with back", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    });
  });
});
