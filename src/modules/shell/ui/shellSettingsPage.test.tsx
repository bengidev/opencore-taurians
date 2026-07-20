import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { GUI_SCALE_DEFAULT } from "../../session/domain/sessionGuiScale";
import * as sessionWorkArea from "../../session/infrastructure/sessionWorkArea";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useSessionStore } from "../../session/state/sessionStore";
import { DEFAULT_SHELL_PANEL_WIDTH } from "../state/shellPanelSizing";
import { useShellStore } from "../state/shellStore";
import { ShellScreen } from "./shellScreen";

vi.mock("../../session/infrastructure/sessionWorkArea", () => ({
  readLogicalWorkArea: vi.fn(),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    id,
    "aria-label": ariaLabel,
    min,
    max,
    step,
    value,
    onValueChange,
  }: {
    id?: string;
    "aria-label"?: string;
    min?: number;
    max?: number;
    step?: number;
    value?: number[];
    onValueChange?: (value: number[]) => void;
  }) => (
    <input
      id={id}
      type="range"
      role="slider"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value?.[0] ?? min}
      onChange={(event) => onValueChange?.([Number(event.currentTarget.value)])}
    />
  ),
}));

function dismissSettings() {
  fireEvent.transitionEnd(screen.getByRole("dialog", { name: "Settings" }), {
    propertyName: "opacity",
  });
}

describe("ShellSettingsPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue(null);
    useMemoryPersistStorage();
    useShellStore.setState({
      leftVisible: true,
      rightVisible: false,
      bottomVisible: true,
      settingsOpen: false,
      leftPanelWidth: 320,
      rightPanelWidth: 320,
      explorerAutoRefresh: "live",
    });
    useThemeStore.setState({ mode: "light" });
    useSessionStore.setState({ guiScale: GUI_SCALE_DEFAULT, hasHydrated: true });
  });

  it("opens full-page settings from the left panel header", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toHaveTextContent("Settings");
  });

  it("defaults to light theme and live explorer updates", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Live updates" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(useThemeStore.getState().mode).toBe("light");
    expect(useShellStore.getState().explorerAutoRefresh).toBe("live");
  });

  it("persists explorer auto-refresh setting", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "On project switch" }));
    expect(useShellStore.getState().explorerAutoRefresh).toBe("on-activate");
    expect(screen.getByRole("button", { name: "On project switch" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Live updates" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clamps gui scale and slider max to monitor fit", async () => {
    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue({
      width: 1920,
      height: 1080,
    });
    useSessionStore.setState({ guiScale: 2 });
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(useSessionStore.getState().guiScale).toBe(1.35);
    });
    expect(screen.getByRole("slider", { name: "GUI scale" })).toHaveAttribute(
      "max",
      "1.35",
    );
  });

  it("refreshes maxFit when settings reopens after work area changes", async () => {
    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue({
      width: 1920,
      height: 1080,
    });
    useSessionStore.setState({ guiScale: 2 });
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(useSessionStore.getState().guiScale).toBe(1.35);
    });
    await user.click(screen.getByRole("button", { name: "Back" }));
    dismissSettings();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    });

    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue({
      width: 1000,
      height: 700,
    });
    useSessionStore.setState({ guiScale: 2 });

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(useSessionStore.getState().guiScale).toBeCloseTo(0.781, 2);
    });
    expect(screen.getByRole("slider", { name: "GUI scale" })).toHaveAttribute(
      "max",
      "0.78125",
    );
  });

  it("updates GUI scale from settings slider", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "GUI scale" });
    fireEvent.change(slider, { target: { value: "1.25" } });
    expect(useSessionStore.getState().guiScale).toBe(1.25);
    expect(screen.getByText("125%")).toBeInTheDocument();
  });

  it("shows GUI scale percentage from session store", async () => {
    useSessionStore.setState({ guiScale: 1.25 });
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("slider", { name: "GUI scale" })).toBeInTheDocument();
    expect(screen.getByText("125%")).toBeInTheDocument();
  });

  it("keeps appearance rows from forcing horizontal overflow classes", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const scaleRow = screen.getByText(/gui scale/i).closest("div");
    expect(scaleRow?.className ?? "").toMatch(/min-w-0|flex/);
    expect(scaleRow?.className ?? "").toMatch(/p-4/);
  });

  it("switches theme from settings", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(useThemeStore.getState().mode).toBe("dark");
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
    dismissSettings();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    });
  });

  it("closes settings with back", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    dismissSettings();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    });
  });
});
