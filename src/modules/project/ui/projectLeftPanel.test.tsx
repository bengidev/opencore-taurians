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

  it("calls onRequestOpenProject when empty CTA is clicked", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    await user.click(screen.getByRole("button", { name: /open project/i }));
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("selects a chunk on click", async () => {
    const user = userEvent.setup();
    const { chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setActiveIds(null, null);
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: /main/i }));
    expect(useProjectStore.getState().activeChunkId).toBe(chunk.id);
  });

  it("collapses and expands project chunk tree", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    expect(screen.getByRole("button", { name: /main/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /app/i }));
    expect(screen.queryByRole("button", { name: /main/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /app/i }));
    expect(screen.getByRole("button", { name: /main/i })).toBeInTheDocument();
  });
});
