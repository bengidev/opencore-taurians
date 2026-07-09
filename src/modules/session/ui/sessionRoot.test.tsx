import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    await user.click(screen.getByRole("button", { name: "Enter OpenCore" }));
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    });
    expect(screen.getByText(/welcome back to/i)).toBeInTheDocument();
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
    await user.click(
      screen.getByRole("button", { name: /reset persisted data/i }),
    );
    await waitFor(() => {
      expect(useSessionStore.getState().onboardingCompleted).toBe(false);
      expect(windowController.lastSize).toEqual({ width: 960, height: 680 });
    });
  });
});
