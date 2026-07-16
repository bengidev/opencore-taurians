import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { createMemoryFolderPicker } from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "../state/projectStore";
import { ProjectAddButton } from "./projectAddButton";

describe("ProjectAddButton", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    useMemoryPersistStorage();
    useWorkspaceStore.setState({ workspacePath: null });
    useProjectStore.getState().resetProjectState();
  });

  it("calls onRequestOpenProject when clicked", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    render(<ProjectAddButton onRequestOpenProject={onOpenProject} />);
    await user.click(screen.getByRole("button", { name: /add project/i }));
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("opens folder via folder picker", async () => {
    const user = userEvent.setup();
    render(<ProjectAddButton folderPicker={createMemoryFolderPicker("/work/new-app")} />);
    await user.click(screen.getByRole("button", { name: /add project/i }));
    await waitFor(() => {
      expect(useProjectStore.getState().projects).toHaveLength(1);
    });
    expect(useProjectStore.getState().projects[0]?.folderPath).toBe("/work/new-app");
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/new-app");
  });

  it("opens a second project when one already exists", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectAddButton folderPicker={createMemoryFolderPicker("/work/second-app")} />);
    await user.click(screen.getByRole("button", { name: /add project/i }));
    await waitFor(() => {
      expect(useProjectStore.getState().projects).toHaveLength(2);
    });
    expect(useProjectStore.getState().projects[1]?.folderPath).toBe("/work/second-app");
    expect(useWorkspaceStore.getState().workspacePath).toBe("/work/second-app");
  });
});
