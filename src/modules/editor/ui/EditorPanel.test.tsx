import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import type { EditorBuffer } from "../state/editorStore";
import { useEditorStore } from "../state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import { EditorPanel } from "./EditorPanel";

vi.mock("./MonacoEditorHost", () => ({
  MonacoEditorHost: () => <div data-testid="monaco-host" />,
}));

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const FILE_B = "/proj/b.ts";

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

function seedReadyTab(id: string, content: string, extras?: Partial<EditorBuffer>): void {
  useEditorStore.setState({
    projectRoot: "/proj",
    tabs: [{ id }],
    activeTabId: id,
    buffers: {
      [id]: {
        content,
        baselineContent: content,
        dirty: false,
        status: "ready",
        errorMessage: null,
        saveError: null,
        readOnly: false,
        ...extras,
      },
    },
  });
}

function resetShellStore(): void {
  useShellStore.setState({ activeMainCard: "chat" });
}

describe("EditorPanel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
    resetShellStore();
  });

  it("shows empty state when no path", () => {
    render(<EditorPanel />);
    expect(
      screen.getByText(/open a file from the explorer or file → open/i),
    ).toBeInTheDocument();
  });

  it("auto-clears openBatchError after a brief delay", () => {
    vi.useFakeTimers();
    try {
      useEditorStore.setState({ openBatchError: "Open a project first" });

      render(<EditorPanel />);
      expect(screen.getByText("Open a project first")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3500);
      });

      expect(useEditorStore.getState().openBatchError).toBeNull();
      expect(screen.queryByText("Open a project first")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows error message on load error", () => {
    useEditorStore.setState({
      projectRoot: PROJECT_ROOT,
      tabs: [{ id: "/proj/missing.ts" }],
      activeTabId: "/proj/missing.ts",
      buffers: {
        "/proj/missing.ts": {
          content: "",
          baselineContent: "",
          dirty: false,
          status: "error",
          errorMessage: "not found",
          saveError: null,
          readOnly: false,
        },
      },
    });
    render(<EditorPanel />);
    expect(screen.getByText("not found")).toBeInTheDocument();
  });

  it("shows Monaco host when ready", async () => {
    seedReadyTab(FILE_A, "hello");
    render(<EditorPanel />);
    expect(await screen.findByTestId("monaco-host")).toBeInTheDocument();
  });

  it("keeps Monaco host mounted while saving", async () => {
    seedReadyTab(FILE_A, "hello", { status: "saving" });
    render(<EditorPanel />);
    expect(await screen.findByTestId("monaco-host")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("shows saveError inline without unmounting Monaco", async () => {
    seedReadyTab(FILE_A, "hello", { saveError: "disk full" });
    render(<EditorPanel />);
    expect(await screen.findByTestId("monaco-host")).toBeInTheDocument();
    expect(screen.getByText("disk full")).toBeInTheDocument();
  });

  it("auto-saves when leaving editor card", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("edited");
    useShellStore.setState({ activeMainCard: "editor" });

    render(<EditorPanel />);

    useShellStore.getState().setActiveMainCard("chat");

    await waitFor(() => {
      expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(false);
    });
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("edited");
    expect(useShellStore.getState().activeMainCard).toBe("chat");
  });

  it("leave-card save failure still switches card and keeps dirty", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    vi.spyOn(api, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("edited");
    useShellStore.setState({ activeMainCard: "editor" });

    render(<EditorPanel />);

    useShellStore.getState().setActiveMainCard("chat");

    await waitFor(() => {
      expect(useEditorStore.getState().buffers[FILE_A]?.saveError).toBe("disk full");
    });
    expect(useShellStore.getState().activeMainCard).toBe("chat");
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
  });

  it("leave-card only saves the active tab when multiple tabs are dirty", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a", [FILE_B]: "file-b" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.getState().setContentFromEditor("file-b-edited");
    useShellStore.setState({ activeMainCard: "editor" });

    render(<EditorPanel />);

    useShellStore.getState().setActiveMainCard("chat");

    await waitFor(() => {
      expect(useEditorStore.getState().buffers[FILE_B]?.dirty).toBe(false);
    });
    expect(await api.readFile(PROJECT_ROOT, FILE_B)).toBe("file-b-edited");
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("file-a");
  });

  it("saves on Cmd+S when editor card is active", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("edited");
    useShellStore.setState({ activeMainCard: "editor" });

    render(<EditorPanel />);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }),
    );

    await waitFor(() => {
      expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(false);
    });
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("edited");
  });

  it("Cmd+S only saves the active tab when multiple tabs are dirty", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a", [FILE_B]: "file-b" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.getState().setContentFromEditor("file-b-edited");
    useShellStore.setState({ activeMainCard: "editor" });

    render(<EditorPanel />);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }),
    );

    await waitFor(() => {
      expect(useEditorStore.getState().buffers[FILE_B]?.dirty).toBe(false);
    });
    expect(await api.readFile(PROJECT_ROOT, FILE_B)).toBe("file-b-edited");
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("file-a");
  });

  it("does not save on Cmd+S when editor card is inactive", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("edited");
    useShellStore.setState({ activeMainCard: "chat" });

    render(<EditorPanel />);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }),
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("hello");
  });
});
