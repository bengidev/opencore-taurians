import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../onboarding";
import { useProjectStore } from "../../project/state/projectStore";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useWorkspaceStore } from "../state/workspaceStore";
import { createMemoryFolderPicker } from "../infrastructure/workspaceFolderPicker";
import { WorkspacePopup } from "./workspacePopup";

describe("WorkspacePopup", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useMemoryPersistStorage();
    useWorkspaceStore.setState({ workspacePath: null });
    useProjectStore.getState().resetProjectState();
  });

  it("sets workspace path when Open project succeeds", async () => {
    const user = userEvent.setup();
    const onOpened = vi.fn();
    render(
      <ThemeProvider>
        <WorkspacePopup
          folderPicker={createMemoryFolderPicker("/tmp/opened")}
          onWorkspaceOpened={onOpened}
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /open project/i }));
    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspacePath).toBe("/tmp/opened");
    });
    expect(useProjectStore.getState().projects[0]?.folderPath).toBe("/tmp/opened");
    expect(onOpened).toHaveBeenCalledOnce();
  });

  it("leaves path null when picker cancels", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <WorkspacePopup folderPicker={createMemoryFolderPicker(null)} />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /open project/i }));
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });

  it("marks non-open actions as disabled", () => {
    render(
      <ThemeProvider>
        <WorkspacePopup folderPicker={createMemoryFolderPicker(null)} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: /new file/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ThemeProvider>
        <WorkspacePopup
          folderPicker={createMemoryFolderPicker(null)}
          onClose={onClose}
        />
      </ThemeProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: /close workspace popup/i }),
    );
    fireEvent.transitionEnd(screen.getByRole("dialog"), {
      propertyName: "opacity",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ThemeProvider>
        <WorkspacePopup
          folderPicker={createMemoryFolderPicker(null)}
          onClose={onClose}
        />
      </ThemeProvider>,
    );
    await user.keyboard("{Escape}");
    fireEvent.transitionEnd(screen.getByRole("dialog"), {
      propertyName: "opacity",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <ThemeProvider>
        <WorkspacePopup
          folderPicker={createMemoryFolderPicker(null)}
          onClose={onClose}
        />
      </ThemeProvider>,
    );
    const backdrop = container.firstElementChild as HTMLElement;
    await user.click(backdrop);
    fireEvent.transitionEnd(screen.getByRole("dialog"), {
      propertyName: "opacity",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the dialog within a narrow short viewport", () => {
    const { container } = render(
      <ThemeProvider>
        <div style={{ width: 360, height: 400 }}>
          <WorkspacePopup onClose={vi.fn()} />
        </div>
      </ThemeProvider>,
    );
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.className).toMatch(/max-h-/);
    expect(dialog.className).toMatch(/overflow-y-auto|overflow-auto/);
    expect(dialog.className).toMatch(/mx-/);
  });

  it("calls onClose immediately when reduced motion is enabled", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(
      <ThemeProvider>
        <WorkspacePopup
          folderPicker={createMemoryFolderPicker(null)}
          onClose={onClose}
        />
      </ThemeProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: /close workspace popup/i }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
