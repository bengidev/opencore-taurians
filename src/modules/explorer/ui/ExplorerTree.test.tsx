import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders grayscale Material icons for files and folders", async () => {
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [
          { name: "main.dart", path: "/proj/main.dart", isDir: false },
          { name: "src", path: "/proj/src", isDir: true },
        ],
        ["/proj/src"]: [],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    const { container } = render(<ExplorerTree />);
    expect(await screen.findByText("main.dart")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();

    const fileRow = screen.getByText("main.dart").closest("button");
    const fileImg = fileRow?.querySelector("img");
    expect(fileImg).not.toBeNull();
    expect(fileImg?.getAttribute("src") ?? "").toMatch(/dart\.svg/i);
    expect(fileImg?.className ?? "").toMatch(/grayscale/);

    const folderRow = screen.getByText("src").closest("button");
    const folderImg = folderRow?.querySelector("img");
    expect(folderImg).not.toBeNull();
    expect(folderImg?.getAttribute("src") ?? "").toMatch(/folder-src\.svg/i);
    expect(folderImg?.className ?? "").toMatch(/grayscale/);

    expect(container.querySelector("svg.lucide-file")).toBeNull();
    expect(container.querySelector("svg.lucide-folder")).toBeNull();
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
