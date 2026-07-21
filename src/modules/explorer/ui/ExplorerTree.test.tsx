import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileCode } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../../editor/state/editorStore";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../../shell/state/shellStore";
import { useProjectStore } from "../../project/state/projectStore";
import { createMemoryExplorerApi } from "../api/createMemoryExplorerApi";
import { useExplorerStore } from "../state/explorerStore";
import { ExplorerTree } from "./ExplorerTree";

describe("ExplorerTree", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useExplorerStore.getState().resetExplorerState();
    useEditorStore.setState({ openFilePath: null });
  });

  it("renders project files", async () => {
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    render(<ExplorerTree />);
    expect(await screen.findByText("a.ts")).toBeInTheDocument();
  });

  it("uses a type-specific Lucide icon for known file extensions", async () => {
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    const { container } = render(<ExplorerTree />);
    expect(await screen.findByText("a.ts")).toBeInTheDocument();

    const icon = container.querySelector("svg.lucide-file-code");
    expect(icon).not.toBeNull();
    // Sanity: helper agreement (same component Lucide would render)
    expect(FileCode).toBeTruthy();
  });

  it("file click sets editor card and openFilePath", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    const filePath = "/proj/a.ts";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: filePath, isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    const setActiveMainCardSpy = vi.spyOn(useShellStore.getState(), "setActiveMainCard");
    const setOpenFilePathSpy = vi.spyOn(useEditorStore.getState(), "setOpenFilePath");

    render(<ExplorerTree />);
    await user.click(await screen.findByText("a.ts"));

    expect(setActiveMainCardSpy).toHaveBeenCalledWith("editor");
    expect(setOpenFilePathSpy).toHaveBeenCalledWith(filePath);
  });

  it("expands a folder when the row is clicked", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    const subDir = "/proj/src";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "src", path: subDir, isDir: true }],
        [subDir]: [{ name: "a.ts", path: "/proj/src/a.ts", isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    render(<ExplorerTree />);
    await user.click(screen.getByRole("button", { name: "src" }));

    expect(await screen.findByText("a.ts")).toBeInTheDocument();
    expect(useExplorerStore.getState().expandedPaths.has(subDir)).toBe(true);
  });
});
