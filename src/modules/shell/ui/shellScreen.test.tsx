import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SHELL_LAYOUT_REFERENCE_WIDTH } from "../state/shellColumnLayout";
import { DEFAULT_SHELL_PANEL_WIDTH } from "../state/shellPanelSizing";
import { useShellStore } from "../state/shellStore";
import { ShellScreen } from "./shellScreen";

function mockShellWidth(width: number) {
  class RO {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      Object.defineProperty(target, "clientWidth", {
        configurable: true,
        value: width,
      });
      this.cb(
        [{ target, contentRect: { width } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", RO);
}

function dismissPanelSlot(panelLabel: string) {
  const panel = screen.getByLabelText(panelLabel);
  const slot = panel.closest("[data-shell-panel-slot]");
  if (!slot) {
    throw new Error(`Could not find animated slot wrapper for ${panelLabel}`);
  }
  fireEvent.transitionEnd(slot, { propertyName: "width" });
}

describe("ShellScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
      bottomVisible: true,
      settingsOpen: false,
      leftPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
      rightPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
    });
  });

  it("keeps inactive main cards mounted while swapping", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    const terminalInput = screen.getByLabelText("terminal-dummy-note");
    await user.type(terminalInput, "kept");
    await user.click(screen.getByRole("tab", { name: "Terminal" }));
    await user.click(screen.getByRole("tab", { name: "Editor" }));
    await user.click(screen.getByRole("tab", { name: "Terminal" }));
    expect(terminalInput).toHaveValue("kept");
  });

  it("hides left and right panels independently", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    expect(screen.getByLabelText("left panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide left panel" }));
    dismissPanelSlot("left panel");
    expect(screen.queryByLabelText("left panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show left panel" })).toBeInTheDocument();
    expect(screen.getByLabelText("right panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide right panel" }));
    dismissPanelSlot("right panel");
    expect(screen.queryByLabelText("right panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show right panel" })).toBeInTheDocument();
  });

  it("renders bottom panel inside the center column only", () => {
    render(<ShellScreen />);
    expect(screen.getByLabelText("bottom panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides bottom panel when disabled in settings", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("switch", { name: "Show bottom panel" }));
    expect(screen.queryByLabelText("bottom panel")).not.toBeInTheDocument();
  });

  it("resizes the left panel from its right border", () => {
    render(<ShellScreen />);
    const handle = screen.getByRole("separator", { name: /resize left panel/i });

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(useShellStore.getState().leftPanelWidth).toBe(258);
  });

  it("uses preferred panel widths at the layout reference width", () => {
    mockShellWidth(SHELL_LAYOUT_REFERENCE_WIDTH);
    const { container } = render(<ShellScreen />);
    const leftSlot = container.querySelector(
      '[data-shell-panel-side="left"]',
    ) as HTMLElement;
    expect(leftSlot.style.width).toBe(`${DEFAULT_SHELL_PANEL_WIDTH}px`);
  });

  it("scales displayed panel widths below the reference width", () => {
    mockShellWidth(1000);
    const { container } = render(<ShellScreen />);
    const scale = 1000 / SHELL_LAYOUT_REFERENCE_WIDTH;
    const expected = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
    const leftSlot = container.querySelector(
      '[data-shell-panel-side="left"]',
    ) as HTMLElement;
    expect(leftSlot.style.width).toBe(`${expected}px`);
  });

  it("keeps preferred store width when dragging under a narrow shell", () => {
    mockShellWidth(1000);
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
