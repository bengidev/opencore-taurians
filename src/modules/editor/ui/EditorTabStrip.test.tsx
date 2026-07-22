import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
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
    activeTabId: null,
    buffers: {},
    nextUntitled: 1,
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
      tabs: [{ id: FILE_A }, { id: FILE_B }],
      activeTabId: FILE_B,
      buffers: {
        [FILE_A]: seedBuffer(FILE_A, { dirty: true }),
        [FILE_B]: seedBuffer(FILE_B),
      },
    });

    render(
      <EditorTabStrip onRequestCloseTab={vi.fn()} onRequestSaveAs={vi.fn()} />,
    );

    expect(screen.getByRole("tab", { name: /a\.ts/i })).toHaveTextContent("•");
    expect(screen.getByRole("tab", { name: /b\.ts/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("clicking a tab calls setActiveTabId", async () => {
    const user = userEvent.setup();
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }, { id: FILE_B }],
      activeTabId: FILE_B,
      buffers: {
        [FILE_A]: seedBuffer(FILE_A),
        [FILE_B]: seedBuffer(FILE_B),
      },
    });
    const setActiveTabId = vi.spyOn(useEditorStore.getState(), "setActiveTabId");

    render(
      <EditorTabStrip onRequestCloseTab={vi.fn()} onRequestSaveAs={vi.fn()} />,
    );

    await user.click(screen.getByRole("tab", { name: /a\.ts/i }));

    expect(setActiveTabId).toHaveBeenCalledWith(FILE_A);
  });

  it("close button calls onRequestCloseTab with that id", async () => {
    const user = userEvent.setup();
    const onRequestCloseTab = vi.fn();
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }],
      activeTabId: FILE_A,
      buffers: { [FILE_A]: seedBuffer(FILE_A) },
    });

    render(
      <EditorTabStrip
        onRequestCloseTab={onRequestCloseTab}
        onRequestSaveAs={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /close a\.ts/i }));

    expect(onRequestCloseTab).toHaveBeenCalledWith(FILE_A);
  });

  it("enables + and opens an untitled tab", async () => {
    const user = userEvent.setup();
    useEditorStore.getState().bindApi(createMemoryEditorApi());
    useEditorStore.setState({ projectRoot: "/proj" });
    render(
      <EditorTabStrip onRequestCloseTab={() => {}} onRequestSaveAs={() => {}} />,
    );
    const add = screen.getByRole("button", { name: /new untitled file/i });
    expect(add).toBeEnabled();
    await user.click(add);
    expect(useEditorStore.getState().tabs[0]?.id).toBe("untitled:1");
    expect(screen.getByRole("tab", { name: /untitled-1/i })).toBeTruthy();
  });

  it("drop of explorer file MIME calls openFile", async () => {
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    const openFile = vi
      .spyOn(useEditorStore.getState(), "openFile")
      .mockResolvedValue(true);

    render(
      <EditorTabStrip onRequestCloseTab={vi.fn()} onRequestSaveAs={vi.fn()} />,
    );

    const strip = screen.getByRole("tablist", { name: /editor tabs/i });
    const dataTransfer = createExplorerFileDataTransfer(FILE_C);

    fireEvent.dragOver(strip, { dataTransfer });
    fireEvent.drop(strip, { dataTransfer });

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    expect(dataTransfer.types).toContain(EXPLORER_FILE_PATH_MIME);
  });
});
