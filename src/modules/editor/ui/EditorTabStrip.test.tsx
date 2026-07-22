import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorBuffer } from "../state/editorStore";
import { useEditorStore } from "../state/editorStore";
import {
  EXPLORER_FILE_PATH_MIME,
  setExplorerFileDragData,
} from "../dnd/explorerFileDrag";
import { EditorTabStrip } from "./EditorTabStrip";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const FILE_B = "/proj/b.ts";
const FILE_C = "/proj/c.ts";

function resetEditorStore(): void {
  useEditorStore.setState({
    api: null,
    projectRoot: null,
    tabs: [],
    activePath: null,
    buffers: {},
  });
}

function seedBuffer(path: string, extras?: Partial<EditorBuffer>): EditorBuffer {
  return {
    content: "",
    baselineContent: "",
    dirty: false,
    status: "ready",
    errorMessage: null,
    saveError: null,
    ...extras,
  };
}

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

describe("EditorTabStrip", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
  });

  it("renders basenames, dirty marker, and selected active tab", () => {
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ path: FILE_A }, { path: FILE_B }],
      activePath: FILE_B,
      buffers: {
        [FILE_A]: seedBuffer(FILE_A, { dirty: true }),
        [FILE_B]: seedBuffer(FILE_B),
      },
    });

    render(<EditorTabStrip onRequestCloseTab={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /a\.ts/i })).toHaveTextContent("•");
    expect(screen.getByRole("tab", { name: /b\.ts/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("clicking a tab calls setActivePath", async () => {
    const user = userEvent.setup();
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ path: FILE_A }, { path: FILE_B }],
      activePath: FILE_B,
      buffers: {
        [FILE_A]: seedBuffer(FILE_A),
        [FILE_B]: seedBuffer(FILE_B),
      },
    });
    const setActivePath = vi.spyOn(useEditorStore.getState(), "setActivePath");

    render(<EditorTabStrip onRequestCloseTab={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /a\.ts/i }));

    expect(setActivePath).toHaveBeenCalledWith(FILE_A);
  });

  it("close button calls onRequestCloseTab with that path", async () => {
    const user = userEvent.setup();
    const onRequestCloseTab = vi.fn();
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ path: FILE_A }],
      activePath: FILE_A,
      buffers: { [FILE_A]: seedBuffer(FILE_A) },
    });

    render(<EditorTabStrip onRequestCloseTab={onRequestCloseTab} />);

    await user.click(screen.getByRole("button", { name: /close a\.ts/i }));

    expect(onRequestCloseTab).toHaveBeenCalledWith(FILE_A);
  });

  it("renders a disabled + button", () => {
    render(<EditorTabStrip onRequestCloseTab={vi.fn()} />);

    expect(screen.getByRole("button", { name: /new untitled file/i })).toBeDisabled();
  });

  it("drop of explorer file MIME calls openFile", async () => {
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    const openFile = vi
      .spyOn(useEditorStore.getState(), "openFile")
      .mockResolvedValue(true);

    render(<EditorTabStrip onRequestCloseTab={vi.fn()} />);

    const strip = screen.getByRole("tablist", { name: /editor tabs/i });
    const dataTransfer = createExplorerFileDataTransfer(FILE_C);

    fireEvent.dragOver(strip, { dataTransfer });
    fireEvent.drop(strip, { dataTransfer });

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    expect(dataTransfer.types).toContain(EXPLORER_FILE_PATH_MIME);
  });
});
