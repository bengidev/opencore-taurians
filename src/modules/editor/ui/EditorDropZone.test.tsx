import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginExplorerFileDrag,
  clearExplorerFileDrag,
} from "../dnd/explorerFileDrag";
import { useEditorStore } from "../state/editorStore";
import { useExplorerStore } from "../../explorer/state/explorerStore";
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
  useExplorerStore.setState({ projectRoot: null });
  useShellStore.setState({ activeMainCard: "chat" });
  clearExplorerFileDrag();
}

function pointerDropOn(target: Element, clientX = 10, clientY = 20): void {
  vi.mocked(document.elementFromPoint).mockReturnValue(target);
  fireEvent.pointerMove(document, { clientX, clientY });
  fireEvent.pointerUp(document, { clientX, clientY });
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
    clearExplorerFileDrag();
    vi.restoreAllMocks();
  });

  it("Explorer pointer drop on panel body calls openFile and focuses Editor card", async () => {
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
    beginExplorerFileDrag(FILE_C);
    pointerDropOn(body);

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    await vi.waitFor(() => {
      expect(useShellStore.getState().activeMainCard).toBe("editor");
    });
  });

  it("pointer drop adopts explorer projectRoot when editor has none", async () => {
    useExplorerStore.setState({ projectRoot: PROJECT_ROOT });
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
    });

    const body = screen.getByTestId("panel-body");
    beginExplorerFileDrag(FILE_C);
    pointerDropOn(body);

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    expect(useEditorStore.getState().projectRoot).toBe(PROJECT_ROOT);
  });

  it("pointer drop over nested surface still opens (Monaco-like child)", async () => {
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    const openFile = vi
      .spyOn(useEditorStore.getState(), "openFile")
      .mockResolvedValue(true);

    render(
      <EditorDropZone>
        <div data-testid="monaco-like">monaco</div>
      </EditorDropZone>,
    );

    await vi.waitFor(() => {
      expect(dropHandler).toBeDefined();
    });

    const surface = screen.getByTestId("monaco-like");
    beginExplorerFileDrag(FILE_C);
    pointerDropOn(surface);

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    await vi.waitFor(() => {
      expect(useShellStore.getState().activeMainCard).toBe("editor");
    });
  });

  it("Explorer pointer drop does not focus Editor card when openFile returns false", async () => {
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    const openFile = vi
      .spyOn(useEditorStore.getState(), "openFile")
      .mockResolvedValue(false);

    render(
      <EditorDropZone>
        <div data-testid="panel-body">body</div>
      </EditorDropZone>,
    );

    await vi.waitFor(() => {
      expect(dropHandler).toBeDefined();
    });

    const body = screen.getByTestId("panel-body");
    beginExplorerFileDrag(FILE_C);
    pointerDropOn(body);

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    await vi.waitFor(() => {
      expect(openFile.mock.settledResults.length).toBeGreaterThan(0);
    });
    expect(useShellStore.getState().activeMainCard).toBe("chat");
  });

  it("highlights the zone while an Explorer pointer drag is over it", async () => {
    const { container } = render(
      <EditorDropZone>
        <div data-testid="panel-body">body</div>
      </EditorDropZone>,
    );

    await vi.waitFor(() => {
      expect(dropHandler).toBeDefined();
    });

    const body = screen.getByTestId("panel-body");
    const zone = container.querySelector("[data-editor-drop-zone]");
    beginExplorerFileDrag(FILE_C);
    vi.mocked(document.elementFromPoint).mockReturnValue(body);
    fireEvent.pointerMove(document, { clientX: 10, clientY: 20 });

    expect(zone).toHaveAttribute("data-drop-active");
  });

  it("OS drop adopts explorer projectRoot before openPaths", async () => {
    useExplorerStore.setState({ projectRoot: PROJECT_ROOT });
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
    });

    const body = screen.getByTestId("panel-body");
    vi.mocked(document.elementFromPoint).mockReturnValue(body);

    dropHandler!({
      payload: { paths: ["/proj/security.md"], x: 10, y: 20 },
    });

    await vi.waitFor(() => {
      expect(openPaths).toHaveBeenCalledWith(["/proj/security.md"]);
    });
    expect(useEditorStore.getState().projectRoot).toBe(PROJECT_ROOT);
    expect(useShellStore.getState().activeMainCard).toBe("editor");
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

  it("OS drop does not focus Editor card when openPaths returns false", async () => {
    const openPaths = vi
      .spyOn(useEditorStore.getState(), "openPaths")
      .mockResolvedValue(false);

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
    expect(useShellStore.getState().activeMainCard).toBe("chat");
  });

  it("ignores OS drops with an empty path list", async () => {
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
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
    });

    const body = screen.getByTestId("panel-body");
    vi.mocked(document.elementFromPoint).mockReturnValue(body);
    openPaths.mockClear();

    dropHandler!({
      payload: { paths: [], x: 10, y: 20 },
    });

    expect(openPaths).not.toHaveBeenCalled();
    expect(useShellStore.getState().activeMainCard).toBe("chat");
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
