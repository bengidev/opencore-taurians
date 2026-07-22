import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { createMemoryEditorFilePicker } from "../infrastructure/editorFilePicker";
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
const OUTSIDE = "/tmp/outside.ts";

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
    readOnly: false,
    ...extras,
  };
}

function stripProps(overrides?: {
  onRequestCloseTab?: (id: string) => void;
  onRequestSaveAs?: (id: string) => void;
  onRequestCloseOthers?: (keepId: string) => void;
  onRequestCloseAll?: () => void;
}) {
  return {
    onRequestCloseTab: vi.fn(),
    onRequestSaveAs: vi.fn(),
    onRequestCloseOthers: vi.fn(),
    onRequestCloseAll: vi.fn(),
    ...overrides,
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

    render(<EditorTabStrip {...stripProps()} />);

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

    render(<EditorTabStrip {...stripProps()} />);

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
      <EditorTabStrip {...stripProps({ onRequestCloseTab })} />,
    );

    await user.click(screen.getByRole("button", { name: /close a\.ts/i }));

    expect(onRequestCloseTab).toHaveBeenCalledWith(FILE_A);
  });

  it("enables + and opens an untitled tab", async () => {
    const user = userEvent.setup();
    useEditorStore.getState().bindApi(createMemoryEditorApi());
    useEditorStore.setState({ projectRoot: "/proj" });
    render(
      <EditorTabStrip
        {...stripProps({
          onRequestCloseTab: () => {},
          onRequestSaveAs: () => {},
        })}
      />,
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

    render(<EditorTabStrip {...stripProps()} />);

    const strip = screen.getByRole("tablist", { name: /editor tabs/i });
    const dataTransfer = createExplorerFileDataTransfer(FILE_C);

    fireEvent.dragOver(strip, { dataTransfer });
    fireEvent.drop(strip, { dataTransfer });

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    expect(dataTransfer.types).toContain(EXPLORER_FILE_PATH_MIME);
  });

  it("does not render a strip Save As button", () => {
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }],
      activeTabId: FILE_A,
      buffers: { [FILE_A]: seedBuffer(FILE_A) },
    });
    render(<EditorTabStrip {...stripProps()} />);
    expect(screen.queryByRole("button", { name: /^save as/i })).toBeNull();
  });

  it("tab context menu Save As calls onRequestSaveAs with that tab id", async () => {
    const onRequestSaveAs = vi.fn();
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }, { id: FILE_B }],
      activeTabId: FILE_B,
      buffers: {
        [FILE_A]: seedBuffer(FILE_A),
        [FILE_B]: seedBuffer(FILE_B),
      },
    });
    render(<EditorTabStrip {...stripProps({ onRequestSaveAs })} />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
    await userEvent.setup().click(await screen.findByRole("menuitem", { name: /save as/i }));
    expect(onRequestSaveAs).toHaveBeenCalledWith(FILE_A);
    expect(useEditorStore.getState().activeTabId).toBe(FILE_A);
  });

  it("tab context menu Save on path tab calls saveTab", async () => {
    useEditorStore.getState().bindApi(createMemoryEditorApi({ files: { [FILE_A]: "x" } }));
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }],
      activeTabId: FILE_A,
      buffers: { [FILE_A]: seedBuffer(FILE_A, { content: "y", dirty: true }) },
    });
    const saveTab = vi.spyOn(useEditorStore.getState(), "saveTab");
    render(<EditorTabStrip {...stripProps()} />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
    await userEvent.setup().click(await screen.findByRole("menuitem", { name: /^save$/i }));
    expect(saveTab).toHaveBeenCalledWith(FILE_A);
  });

  it("tab context menu Save on untitled tab calls onRequestSaveAs and not saveTab", async () => {
    useEditorStore.getState().bindApi(createMemoryEditorApi());
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    const untitledId = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("untitled-draft");
    const onRequestSaveAs = vi.fn();
    const saveTab = vi.spyOn(useEditorStore.getState(), "saveTab");
    saveTab.mockClear();
    render(<EditorTabStrip {...stripProps({ onRequestSaveAs })} />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: /untitled-1/i }));
    await userEvent.setup().click(await screen.findByRole("menuitem", { name: /^save$/i }));
    expect(onRequestSaveAs).toHaveBeenCalledWith(untitledId);
    expect(saveTab).not.toHaveBeenCalled();
  });

  it("shows RO affordance and disables Save/Save As for readOnly tab", async () => {
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: OUTSIDE }],
      activeTabId: OUTSIDE,
      buffers: {
        [OUTSIDE]: {
          content: "x",
          baselineContent: "x",
          dirty: false,
          status: "ready",
          errorMessage: null,
          saveError: null,
          readOnly: true,
        },
      },
    });
    render(
      <EditorTabStrip
        onRequestCloseTab={vi.fn()}
        onRequestSaveAs={vi.fn()}
        onRequestCloseOthers={vi.fn()}
        onRequestCloseAll={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: /outside\.ts/i })).toBeTruthy();
    expect(screen.getByLabelText(/read-only/i)).toBeTruthy();
    fireEvent.contextMenu(screen.getByRole("tab", { name: /outside\.ts/i }));
    const saveItem = await screen.findByRole("menuitem", { name: /^save$/i });
    expect(saveItem).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: /save as/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("Open… button calls openPaths with picked files", async () => {
    const api = createMemoryEditorApi({
      files: { "/proj/a.ts": "a" },
    });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    const openPaths = vi.spyOn(useEditorStore.getState(), "openPaths");
    const picker = createMemoryEditorFilePicker(["/proj/a.ts"]);

    render(
      <EditorTabStrip
        filePicker={picker}
        onRequestCloseTab={vi.fn()}
        onRequestSaveAs={vi.fn()}
        onRequestCloseOthers={vi.fn()}
        onRequestCloseAll={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /open/i }));
    expect(openPaths).toHaveBeenCalledWith(["/proj/a.ts"]);
  });

  it("Close Others is disabled when only one tab is open", async () => {
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }],
      activeTabId: FILE_A,
      buffers: { [FILE_A]: seedBuffer(FILE_A) },
    });
    render(<EditorTabStrip {...stripProps()} />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
    const item = await screen.findByRole("menuitem", { name: /close others/i });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });
});
