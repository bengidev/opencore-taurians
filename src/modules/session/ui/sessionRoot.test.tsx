import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../onboarding";
import { useMemoryPersistStorage } from "../infrastructure/sessionPersistStorage";
import * as sessionWorkArea from "../infrastructure/sessionWorkArea";
import { createMemoryWindowController } from "../infrastructure/sessionWindowController";
import { useSessionStore } from "../state/sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { SessionRoot } from "./sessionRoot";

vi.mock("../infrastructure/sessionWorkArea", () => ({
  readLogicalWorkArea: vi.fn(),
}));

describe("SessionRoot", () => {
  const windowController = createMemoryWindowController();

  beforeEach(() => {
    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue(null);
    useMemoryPersistStorage();
    useSessionStore.setState({
      onboardingCompleted: false,
      hasHydrated: true,
      guiScale: 1,
    });
    useWorkspaceStore.setState({ workspacePath: null });
    windowController.lastSize = null;
    windowController.centerCount = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it("applies gui zoom and scaled onboarding window size", async () => {
    useSessionStore.setState({ guiScale: 1.5, hasHydrated: true });
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} skipPersistBoot />
      </ThemeProvider>,
    );
    const root = document.querySelector("[data-gui-scale]");
    expect(root).toHaveAttribute("data-gui-scale", "1.5");
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1440, height: 1020 });
    });
  });

  it("shows onboarding until completed", () => {
    render(
      <ThemeProvider>
        <SessionRoot
          windowController={windowController}
          skipPersistBoot
        />
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Enter OpenCore" }),
    ).toBeInTheDocument();
  });

  it("shows shell and workspace popup after onboarding without workspace", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SessionRoot
          windowController={windowController}
          skipPersistBoot
        />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 960, height: 680 });
    });
    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    });
    await waitFor(() => {
      expect(screen.getByText(/welcome back to/i)).toBeInTheDocument();
    });
  });

  it("hides workspace popup after close without selecting a workspace", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SessionRoot
          windowController={windowController}
          skipPersistBoot
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    await waitFor(() => {
      expect(screen.getByText(/welcome back to/i)).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /close workspace popup/i }),
    );
    fireEvent.transitionEnd(screen.getByRole("dialog"), {
      propertyName: "opacity",
    });
    expect(screen.queryByText(/welcome back to/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("left panel")).toBeInTheDocument();
  });

  it("applies shell window size for returning users", async () => {
    useSessionStore.setState({ onboardingCompleted: true, hasHydrated: true });
    useWorkspaceStore.setState({ workspacePath: "/tmp/x" });
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} skipPersistBoot />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    });
  });

  it("reset returns to onboarding and onboarding window size", async () => {
    const user = userEvent.setup();
    useSessionStore.setState({ onboardingCompleted: true, hasHydrated: true });
    useWorkspaceStore.setState({ workspacePath: "/tmp/x" });
    render(
      <ThemeProvider>
        <SessionRoot
          windowController={windowController}
          skipPersistBoot
        />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    });
    await user.click(
      screen.getByRole("button", { name: /reset persisted data/i }),
    );
    await waitFor(() => {
      expect(useSessionStore.getState().onboardingCompleted).toBe(false);
      expect(windowController.lastSize).toEqual({ width: 960, height: 680 });
    });
  });

  it("reset during enter transition aborts commit and restores onboarding size", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ThemeProvider>
        <SessionRoot
          windowController={windowController}
          skipPersistBoot
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    });
    expect(
      screen.getByRole("button", { name: "Enter OpenCore" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /reset persisted data/i }),
    );

    await waitFor(() => {
      expect(useSessionStore.getState().onboardingCompleted).toBe(false);
      expect(windowController.lastSize).toEqual({ width: 960, height: 680 });
    });

    await vi.advanceTimersByTimeAsync(280);
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
    expect(
      screen.getByRole("button", { name: "Enter OpenCore" }),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("resizes to shell window size when enter transition begins", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ThemeProvider>
        <SessionRoot
          windowController={windowController}
          skipPersistBoot
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    await vi.advanceTimersByTimeAsync(280);
    expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    vi.useRealTimers();
  });

  it("restores onboarding window size after shell round-trip", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SessionRoot
          windowController={windowController}
          skipPersistBoot
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    await user.click(
      screen.getByRole("button", { name: /reset persisted data/i }),
    );
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 960, height: 680 });
    });
    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
  });

  it("clamps gui scale on ready for onboarding base", async () => {
    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue({
      width: 1000,
      height: 700,
    });
    useSessionStore.setState({ guiScale: 2, hasHydrated: true, onboardingCompleted: false });
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} skipPersistBoot />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(useSessionStore.getState().guiScale).toBeCloseTo(1.029, 2);
    });
  });

  it("clamps gui scale on ready for shell base", async () => {
    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue({
      width: 1920,
      height: 1080,
    });
    useSessionStore.setState({ guiScale: 2, hasHydrated: true, onboardingCompleted: true });
    useWorkspaceStore.setState({ workspacePath: "/tmp/x" });
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} skipPersistBoot />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(useSessionStore.getState().guiScale).toBe(1.35);
    });
  });

  it("sizes window with clamped scale on ready, not stale persisted scale", async () => {
    vi.mocked(sessionWorkArea.readLogicalWorkArea).mockResolvedValue({
      width: 1920,
      height: 1080,
    });
    useSessionStore.setState({ guiScale: 2, hasHydrated: true, onboardingCompleted: true });
    useWorkspaceStore.setState({ workspacePath: "/tmp/x" });
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} skipPersistBoot />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1728, height: 1080 });
    });
  });
});
