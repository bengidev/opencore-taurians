import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../state/editorStore";
import { useEditorOsFileDrop } from "./useEditorOsFileDrop";

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

function DropHost({
  onDropPaths,
  setOsDropActive,
}: {
  onDropPaths?: (paths: string[]) => Promise<boolean>;
  setOsDropActive?: (active: boolean) => void;
}) {
  useEditorOsFileDrop({ onDropPaths, setOsDropActive });
  return (
    <div data-editor-drop-zone="" data-testid="editor-drop-zone">
      Editor strip
    </div>
  );
}

function resetEditorStore(): void {
  useEditorStore.setState({
    api: null,
    projectRoot: null,
    tabs: [],
    activeTabId: null,
    buffers: {},
    nextUntitled: 1,
  });
}

describe("useEditorOsFileDrop", () => {
  beforeEach(() => {
    resetEditorStore();
    dropHandler = undefined;
    dragHandler = undefined;
    document.elementFromPoint = vi.fn();
  });

  afterEach(() => {
    cleanup();
    dropHandler = undefined;
    dragHandler = undefined;
    vi.restoreAllMocks();
  });

  it("calls openPaths when OS drop hits the editor drop zone", async () => {
    const onDropPaths = vi.fn().mockResolvedValue(true);
    render(<DropHost onDropPaths={onDropPaths} />);

    const zone = screen.getByTestId("editor-drop-zone");
    vi.mocked(document.elementFromPoint).mockReturnValue(zone);

    await vi.waitFor(() => expect(dropHandler).toBeDefined());

    dropHandler!({
      payload: { paths: ["/tmp/a.ts"], x: 10, y: 20 },
    });

    await vi.waitFor(() => {
      expect(onDropPaths).toHaveBeenCalledWith(["/tmp/a.ts"]);
    });
  });

  it("does not call openPaths when OS drop misses the editor drop zone", async () => {
    const onDropPaths = vi.fn().mockResolvedValue(true);
    render(<DropHost onDropPaths={onDropPaths} />);

    vi.mocked(document.elementFromPoint).mockReturnValue(document.body);

    await vi.waitFor(() => expect(dropHandler).toBeDefined());

    dropHandler!({
      payload: { paths: ["/tmp/a.ts"], x: 10, y: 20 },
    });

    expect(onDropPaths).not.toHaveBeenCalled();
  });

  it("sets os drop active on drag over the editor zone and clears on leave", async () => {
    const setOsDropActive = vi.fn();
    render(<DropHost setOsDropActive={setOsDropActive} />);

    const zone = screen.getByTestId("editor-drop-zone");
    vi.mocked(document.elementFromPoint).mockReturnValue(zone);

    await vi.waitFor(() => expect(dragHandler).toBeDefined());

    dragHandler!({
      payload: { phase: "over", paths: [], x: 5, y: 6 },
    });
    expect(setOsDropActive).toHaveBeenCalledWith(true);

    dragHandler!({
      payload: { phase: "leave", paths: [], x: 0, y: 0 },
    });
    expect(setOsDropActive).toHaveBeenCalledWith(false);
  });
});
