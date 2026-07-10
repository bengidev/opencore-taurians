import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../onboarding";
import { useMemoryPersistStorage } from "../infrastructure/sessionPersistStorage";
import { createMemoryWindowController } from "../infrastructure/sessionWindowController";
import { useSessionStore } from "../state/sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { SessionRoot } from "./sessionRoot";

describe("SessionRoot", () => {
  const windowController = createMemoryWindowController();

  beforeEach(() => {
    useMemoryPersistStorage();
    useSessionStore.setState({
      onboardingCompleted: false,
      hasHydrated: true,
    });
    useWorkspaceStore.setState({ workspacePath: null });
    windowController.lastSize = null;
    windowController.centerCount = 0;
  });

  afterEach(() => {
    cleanup();
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
    expect(windowController.lastSize).toEqual({ width: 960, height: 680 });
    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
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
    expect(screen.queryByText(/welcome back to/i)).not.toBeInTheDocument();
    expect(screen.getByText(/left panel/i)).toBeInTheDocument();
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
});
