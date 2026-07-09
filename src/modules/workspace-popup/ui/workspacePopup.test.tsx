import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../onboarding";
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
});
