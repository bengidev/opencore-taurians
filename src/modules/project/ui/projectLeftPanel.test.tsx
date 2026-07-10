import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useProjectStore } from "../state/projectStore";
import { ProjectLeftPanel } from "./projectLeftPanel";

describe("ProjectLeftPanel", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
  });

  it("shows empty CTA when no projects", () => {
    const onOpenProject = vi.fn();
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    expect(screen.getByRole("button", { name: /open project/i })).toBeInTheDocument();
  });

  it("selects a chunk on click", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: /main/i }));
    expect(useProjectStore.getState().activeChunkId).not.toBeNull();
  });
});
