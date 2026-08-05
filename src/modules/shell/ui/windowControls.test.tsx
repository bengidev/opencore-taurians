import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const windowMock = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  isMaximized: vi.fn(),
  onResized: vi.fn<(handler: () => void) => Promise<() => void>>(
    () => Promise.resolve(() => {}),
  ),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowMock,
}));

import { WindowControls } from "./windowControls";

describe("WindowControls", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when custom controls are disabled (macOS)", () => {
    const { container } = render(<WindowControls tag="macos" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when platform is unresolved", () => {
    const { container } = render(<WindowControls tag="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders min/max/close and wires actions on windows", async () => {
    windowMock.isMaximized.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<WindowControls tag="windows" />);
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Maximize" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(windowMock.minimize).toHaveBeenCalled();
    expect(windowMock.toggleMaximize).toHaveBeenCalled();
    expect(windowMock.close).toHaveBeenCalled();
  });

  it("shows Restore when maximized and tracks resize", async () => {
    windowMock.isMaximized.mockResolvedValue(true);
    let resizeHandler: (() => void) | undefined;
    windowMock.onResized.mockImplementation((h: () => void) => {
      resizeHandler = h;
      return Promise.resolve(() => {});
    });
    render(<WindowControls tag="windows" />);
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
    windowMock.isMaximized.mockResolvedValue(false);
    resizeHandler?.();
    expect(await screen.findByRole("button", { name: "Maximize" })).toBeInTheDocument();
  });
});
