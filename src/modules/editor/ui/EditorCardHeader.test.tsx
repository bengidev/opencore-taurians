import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import type { EditorBuffer } from "../state/editorStore";
import { useEditorStore } from "../state/editorStore";
import { EditorCardHeader } from "./EditorCardHeader";
import { promptQuitUntitled } from "./saveAsPromptBridge";

const PROJECT_ROOT = "/proj";

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
});
