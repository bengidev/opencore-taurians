import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLORER_FILE_PATH_MIME,
  setExplorerFileDragData,
} from "../dnd/explorerFileDrag";
import { useEditorStore } from "../state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import { EditorDropZone } from "./EditorDropZone";

const PROJECT_ROOT = "/proj";
const FILE_C = "/proj/c.ts";

type DropHandler = (event: {
  payload: { paths: string[]; x: number; y: number };
}) => void;
type DragHandler = (event: {
  payload: { phase: string; paths: string[]; x: number; y: number };
}) => void;

let dropHandler: DropHandler | undefined;
let dragHandler: DragHandler | undefined;

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: DropHandler | DragHandler) => {
    if (eventName === "explorer://drop") {
      dropHandler = handler as DropHandler;
    }
    if (eventName === "explorer://drag") {
      dragHandler = handler as DragHandler;
    }
    return () => {
      if (eventName === "explorer://drop") dropHandler = undefined;
      if (eventName === "explorer://drag") dragHandler = undefined;
    };
  }),
}));

function createExplorerFileDataTransfer(path: string): DataTransfer {
  const store: Record<string, string> = {};
  const dt = {
    types: [EXPLORER_FILE_PATH_MIME],
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? "",
  } as unknown as DataTransfer;
  setExplorerFileDragData(dt, path);
  return dt;
}

function resetStores(): void {
  useEditorStore.setState({
    api: null,
    projectRoot: null,
    tabs: [],
    activeTabId: null,
    buffers: {},
    nextUntitled: 1,
    openBatchError: null,
  });
  useShellStore.setState({ activeMainCard: "chat" });
}

describe("EditorDropZone", () => {
  beforeEach(() => {
    resetStores();
    dropHandler = undefined;
    dragHandler = undefined;
    document.elementFromPoint = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Explorer MIME drop on panel body calls openFile and focuses Editor card", async () => {
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    const openFile = vi
      .spyOn(useEditorStore.getState(), "openFile")
      .mockResolvedValue(true);

    render(
      <EditorDropZone>
        <div data-testid="panel-body">body</div>
      </EditorDropZone>,
    );

    await vi.waitFor(() => {
      expect(dropHandler).toBeDefined();
      expect(dragHandler).toBeDefined();
    });

    const body = screen.getByTestId("panel-body");
    const dataTransfer = createExplorerFileDataTransfer(FILE_C);
    fireEvent.dragOver(body, { dataTransfer });
    fireEvent.drop(body, { dataTransfer });

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    await vi.waitFor(() => {
      expect(useShellStore.getState().activeMainCard).toBe("editor");
    });
  });

  it("OS drop hitting panel body calls openPaths and focuses Editor card", async () => {
    const openPaths = vi
      .spyOn(useEditorStore.getState(), "openPaths")
      .mockResolvedValue(true);

    render(
      <EditorDropZone>
        <div data-testid="panel-body">body</div>
      </EditorDropZone>,
    );

    await vi.waitFor(() => {
      expect(dropHandler).toBeDefined();
      expect(dragHandler).toBeDefined();
    });

    const body = screen.getByTestId("panel-body");
    vi.mocked(document.elementFromPoint).mockReturnValue(body);

    dropHandler!({
      payload: { paths: ["/tmp/a.ts"], x: 10, y: 20 },
    });

    await vi.waitFor(() => {
      expect(openPaths).toHaveBeenCalledWith(["/tmp/a.ts"]);
    });
    expect(useShellStore.getState().activeMainCard).toBe("editor");
  });

  it("marks the zone with data-editor-drop-zone", async () => {
    const { container } = render(
      <EditorDropZone>
        <div>child</div>
      </EditorDropZone>,
    );
    await vi.waitFor(() => {
      expect(dropHandler).toBeDefined();
      expect(dragHandler).toBeDefined();
    });
    expect(container.querySelector("[data-editor-drop-zone]")).not.toBeNull();
  });
});
