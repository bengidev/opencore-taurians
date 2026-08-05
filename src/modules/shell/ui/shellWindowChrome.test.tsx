import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useProjectStore } from "../../project/state/projectStore";
import { useShellStore } from "../state/shellStore";
import { resolvePlatformForTest } from "@/lib/platform";

// WindowControls (rendered on non-macOS) calls getCurrentWindow(). The real
// Tauri window API needs IPC and is unavailable in jsdom; mirror the mock from
// windowControls.test.tsx so the chrome row renders deterministically.
const windowMock = vi.hoisted(() => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  isMaximized: vi.fn(async () => false),
  onResized: vi.fn(async () => () => {}),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowMock,
}));

import { ShellWindowChrome } from "./shellWindowChrome";

describe("ShellWindowChrome", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useShellStore.setState({
      leftVisible: true,
      rightVisible: true,
      bottomVisible: true,
      settingsOpen: false,
      activeMainCard: "chat",
    });
  });

  it("renders leading icons + centered tabs on macOS, no window controls", async () => {
    resolvePlatformForTest("macos");
    render(<ShellWindowChrome />);
    // usePlatform resolves via a promise microtask after mount; findByRole waits
    // for the re-render so the absence assertions below are meaningful.
    expect(await screen.findByRole("button", { name: "Hide left panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Minimize" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("renders window controls on windows", async () => {
    resolvePlatformForTest("windows");
    render(<ShellWindowChrome />);
    expect(await screen.findByRole("button", { name: "Minimize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Terminal" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Editor" })).toBeInTheDocument();
  });

  it("switches the active main card from the chrome row", async () => {
    resolvePlatformForTest("linux");
    const user = await import("@testing-library/user-event").then((m) => m.default);
    render(<ShellWindowChrome />);
    await user.click(screen.getByRole("tab", { name: "Terminal" }));
    expect(useShellStore.getState().activeMainCard).toBe("terminal");
  });
});
