import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryEditorApi } from "../../editor/api/createMemoryEditorApi";
import {
  EXPLORER_FILE_PATH_MIME,
} from "../../editor/dnd/explorerFileDrag";
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
    useEditorStore.setState({
      api: null,
      projectRoot: null,
      tabs: [],
      activeTabId: null,
      buffers: {},
      nextUntitled: 1,
    });
    useShellStore.setState({ activeMainCard: "chat" });
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

  it("file click still switches to editor and opens/focuses a tab", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    const filePath = "/proj/a.ts";
    const fileContent = "export const a = 1;\n";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const explorerApi = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: filePath, isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(explorerApi);
    await useExplorerStore.getState().loadRoot();

    const editorApi = createMemoryEditorApi({
      files: { [filePath]: fileContent },
    });
    useEditorStore.getState().bindApi(editorApi);

    render(<ExplorerTree />);
    await user.click(await screen.findByText("a.ts"));

    await waitFor(() => {
      expect(useShellStore.getState().activeMainCard).toBe("editor");
    });
    const editorState = useEditorStore.getState();
    expect(editorState.activeTabId).toBe(filePath);
    expect(editorState.tabs.map((t) => t.id)).toEqual([filePath]);
    expect(editorState.buffers[filePath]?.content).toBe(fileContent);
    expect(editorState.buffers[filePath]?.status).toBe("ready");
  });

  it("file rows are draggable with explorer file MIME", async () => {
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

    render(<ExplorerTree />);

    const fileButton = await screen.findByRole("button", { name: "a.ts" });
    expect(fileButton).toHaveAttribute("draggable", "true");

    const store: Record<string, string> = {};
    const dataTransfer = {
      types: [] as string[],
      effectAllowed: "",
      setData: (type: string, value: string) => {
        store[type] = value;
        if (!dataTransfer.types.includes(type)) {
          dataTransfer.types.push(type);
        }
      },
      getData: (type: string) => store[type] ?? "",
    } as unknown as DataTransfer;

    fireEvent.dragStart(fileButton, { dataTransfer });

    expect(dataTransfer.types).toContain(EXPLORER_FILE_PATH_MIME);
    expect(dataTransfer.getData(EXPLORER_FILE_PATH_MIME)).toBe(filePath);
    expect(dataTransfer.effectAllowed).toBe("copy");
  });

  it("folder rows are not draggable", async () => {
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
        [subDir]: [],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    render(<ExplorerTree />);

    const folderButton = await screen.findByRole("button", { name: "src" });
    expect(folderButton.getAttribute("draggable")).not.toBe("true");
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
