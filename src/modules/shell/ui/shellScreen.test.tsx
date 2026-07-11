import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { DEFAULT_SHELL_PANEL_WIDTH } from "../state/shellPanelSizing";
import { useShellStore } from "../state/shellStore";
import { ShellScreen } from "./shellScreen";

describe("ShellScreen", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
      leftPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
      rightPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
    });
  });

  it("keeps inactive main cards mounted while swapping", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    const terminalInput = screen.getByLabelText("terminal-dummy-note");
    await user.type(terminalInput, "kept");
    await user.click(screen.getByRole("button", { name: /terminal/i }));
    await user.click(screen.getByRole("button", { name: /editor/i }));
    await user.click(screen.getByRole("button", { name: /terminal/i }));
    expect(terminalInput).toHaveValue("kept");
  });

  it("hides left and right panels independently", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    expect(screen.getByLabelText("left panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide left panel" }));
    expect(screen.queryByLabelText("left panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show left panel" })).toBeInTheDocument();
    expect(screen.getByLabelText("right panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide right panel" }));
    expect(screen.queryByLabelText("right panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show right panel" })).toBeInTheDocument();
  });

  it("renders bottom panel inside the center column only", () => {
    render(<ShellScreen />);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByText("Bottom Panel")).not.toBeInTheDocument();
  });

  it("resizes the left panel from its right border", () => {
    render(<ShellScreen />);
    const handle = screen.getByRole("separator", { name: /resize left panel/i });

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(useShellStore.getState().leftPanelWidth).toBe(258);
  });

  it("resizes the right panel from its left border", () => {
    render(<ShellScreen />);
    const handle = screen.getByRole("separator", {
      name: /resize right panel/i,
    });

    fireEvent.pointerDown(handle, { clientX: 200, pointerId: 2, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 2 });
    fireEvent.pointerUp(handle, { pointerId: 2 });

    expect(useShellStore.getState().rightPanelWidth).toBe(258);
  });
});
