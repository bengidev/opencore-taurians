import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import type { EditorBuffer } from "../state/editorStore";
import { useEditorStore } from "../state/editorStore";
import { promptCloseTab } from "./closeTabPromptBridge";
import { EditorCardHeader } from "./EditorCardHeader";
import { promptQuitUntitled } from "./saveAsPromptBridge";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const FILE_B = "/proj/b.ts";
const FILE_C = "/proj/c.ts";

vi.mock("../../explorer/api/explorerApi", () => ({
  createTauriExplorerApi: () => ({
    listDir: async () => [],
  }),
}));

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
    content: "hello",
    baselineContent: "hello",
    dirty: false,
    status: "ready",
    errorMessage: null,
    saveError: null,
    ...extras,
  };
}

function seedCleanTab(): void {
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: FILE_A }],
    activeTabId: FILE_A,
    buffers: { [FILE_A]: seedBuffer(FILE_A) },
  });
}

function seedDirtyFileTab(): void {
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: FILE_A }],
    activeTabId: FILE_A,
    buffers: { [FILE_A]: seedBuffer(FILE_A, { content: "edited", dirty: true }) },
  });
}

function seedDirtyUntitled(): string {
  const id = "untitled:1";
  const buffer: EditorBuffer = {
    content: "draft",
    baselineContent: "",
    dirty: true,
    status: "ready",
    errorMessage: null,
    saveError: null,
  };
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id }],
    activeTabId: id,
    buffers: { [id]: buffer },
    nextUntitled: 2,
  });
  return id;
}

describe("EditorCardHeader promptCloseTab", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
  });

  it("promptCloseTab closes a clean tab", async () => {
    seedCleanTab();

    render(<EditorCardHeader />);

    const result = await promptCloseTab(FILE_A);
    expect(result).toBe("closed");
    expect(useEditorStore.getState().tabs.map((t) => t.id)).not.toContain(FILE_A);
  });

  it("promptCloseTab cancel on dirty leaves tab open", async () => {
    const user = userEvent.setup();
    seedDirtyFileTab();

    render(<EditorCardHeader />);

    const pending = promptCloseTab(FILE_A);
    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(await pending).toBe("cancelled");
    expect(useEditorStore.getState().tabs.map((t) => t.id)).toContain(FILE_A);
  });
});

describe("EditorCardHeader quit Untitled handoff", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
  });

  it("Save keeps quit promise pending until Save As succeeds", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi();
    useEditorStore.getState().bindApi(api);
    const id = seedDirtyUntitled();

    render(<EditorCardHeader />);

    const quitPromise = promptQuitUntitled(id);
    let settled = false;
    void quitPromise.finally(() => {
      settled = true;
    });

    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Save As")).toBeInTheDocument();
    });
    expect(settled).toBe(false);

    await user.type(screen.getByLabelText("File name"), "new.ts");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await expect(quitPromise).resolves.toBe("saved");
    expect(settled).toBe(true);
    expect(useEditorStore.getState().tabs.find((t) => t.id === id)).toBeUndefined();
    expect(await api.readFile(PROJECT_ROOT, `${PROJECT_ROOT}/new.ts`)).toBe("draft");
  });

  it("Cancel on quit dialog resolves cancelled", async () => {
    const user = userEvent.setup();
    seedDirtyUntitled();

    render(<EditorCardHeader />);

    const quitPromise = promptQuitUntitled("untitled:1");

    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    await expect(quitPromise).resolves.toBe("cancelled");
    expect(useEditorStore.getState().tabs).toHaveLength(1);
  });

  it("Don't save on quit dialog resolves discarded", async () => {
    const user = userEvent.setup();
    seedDirtyUntitled();

    render(<EditorCardHeader />);

    const quitPromise = promptQuitUntitled("untitled:1");

    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /don't save/i }));

    await expect(quitPromise).resolves.toBe("discarded");
    expect(useEditorStore.getState().tabs).toEqual([]);
  });

  it("cancelling Save As during quit handoff resolves cancelled", async () => {
    const user = userEvent.setup();
    seedDirtyUntitled();

    render(<EditorCardHeader />);

    const quitPromise = promptQuitUntitled("untitled:1");

    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Save As")).toBeInTheDocument();
    });

    const cancelButtons = screen.getAllByRole("button", { name: /^cancel$/i });
    await user.click(cancelButtons[cancelButtons.length - 1]!);

    await expect(quitPromise).resolves.toBe("cancelled");
    expect(useEditorStore.getState().tabs).toHaveLength(1);
  });

  it("Save As createFile failure during quit resolves failed", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi();
    vi.spyOn(api, "createFile").mockRejectedValueOnce(new Error("disk full"));
    useEditorStore.getState().bindApi(api);
    const id = seedDirtyUntitled();

    render(<EditorCardHeader />);

    const quitPromise = promptQuitUntitled(id);

    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Save As")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("File name"), "new.ts");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await expect(quitPromise).resolves.toBe("failed");
    expect(useEditorStore.getState().tabs).toEqual([{ id }]);
    expect(useEditorStore.getState().buffers[id]?.dirty).toBe(true);
  });
});

describe("EditorCardHeader dirty close Save As", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
  });

  it("dirty Untitled close → Save → Save As success removes tab", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi();
    useEditorStore.getState().bindApi(api);
    const id = seedDirtyUntitled();

    render(<EditorCardHeader />);

    await user.click(screen.getByRole("button", { name: /^close untitled-1$/i }));

    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Save As")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("File name"), "new.ts");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().tabs).toEqual([]);
    });
    expect(useEditorStore.getState().tabs.find((t) => t.id === id)).toBeUndefined();
    expect(await api.readFile(PROJECT_ROOT, `${PROJECT_ROOT}/new.ts`)).toBe("draft");
  });

  it("dirty Untitled close → Save As failure then retry success closes tab", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi();
    const createFileSpy = vi
      .spyOn(api, "createFile")
      .mockRejectedValueOnce(new Error("disk full"));
    useEditorStore.getState().bindApi(api);
    const id = seedDirtyUntitled();

    render(<EditorCardHeader />);

    await user.click(screen.getByRole("button", { name: /^close untitled-1$/i }));

    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Save As")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("File name"), "new.ts");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("disk full")).toBeInTheDocument();
    });
    expect(useEditorStore.getState().tabs).toEqual([{ id }]);

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().tabs).toEqual([]);
    });
    expect(createFileSpy).toHaveBeenCalledTimes(2);
    expect(await api.readFile(PROJECT_ROOT, `${PROJECT_ROOT}/new.ts`)).toBe("draft");
  });
});

describe("EditorCardHeader Close Others / Close All", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
  });

  it("Close Others closes clean other tabs and keeps the target", async () => {
    const user = userEvent.setup();
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }, { id: FILE_B }, { id: FILE_C }],
      activeTabId: FILE_B,
      buffers: {
        [FILE_A]: seedBuffer(FILE_A),
        [FILE_B]: seedBuffer(FILE_B),
        [FILE_C]: seedBuffer(FILE_C),
      },
    });

    render(<EditorCardHeader />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: /b\.ts/i }));
    await user.click(await screen.findByRole("menuitem", { name: /close others/i }));
    await waitFor(() => {
      expect(useEditorStore.getState().tabs.map((t) => t.id)).toEqual([FILE_B]);
    });
  });

  it("Close All stops after Cancel on a dirty tab", async () => {
    const user = userEvent.setup();
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: FILE_A }, { id: FILE_B }, { id: FILE_C }],
      activeTabId: FILE_A,
      buffers: {
        [FILE_A]: seedBuffer(FILE_A),
        [FILE_B]: seedBuffer(FILE_B, { content: "edited", dirty: true }),
        [FILE_C]: seedBuffer(FILE_C),
      },
    });

    render(<EditorCardHeader />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
    await user.click(await screen.findByRole("menuitem", { name: /close all/i }));
    await waitFor(() => {
      expect(screen.getByText("Save changes?")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => {
      const ids = useEditorStore.getState().tabs.map((t) => t.id);
      expect(ids).toEqual([FILE_B, FILE_C]);
    });
  });
});
