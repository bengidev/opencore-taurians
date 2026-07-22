import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { useEditorStore } from "../state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import { EditorPanel } from "./EditorPanel";

vi.mock("./MonacoEditorHost", () => ({
  MonacoEditorHost: () => <div data-testid="monaco-host" />,
}));

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";

function resetEditorStore(): void {
  useEditorStore.setState({
    api: null,
    projectRoot: null,
    path: null,
    content: "",
    baselineContent: "",
    dirty: false,
    status: "idle",
    errorMessage: null,
    saveError: null,
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
    expect(screen.getByText(/open a file from the explorer/i)).toBeInTheDocument();
  });

  it("shows error message on load error", () => {
    useEditorStore.setState({
      path: "/proj/missing.ts",
      status: "error",
      errorMessage: "not found",
    });
    render(<EditorPanel />);
    expect(screen.getByText("not found")).toBeInTheDocument();
  });

  it("shows Monaco host when ready", async () => {
    useEditorStore.setState({
      path: "/proj/a.ts",
      content: "hello",
      status: "ready",
    });
    render(<EditorPanel />);
    expect(await screen.findByTestId("monaco-host")).toBeInTheDocument();
  });

  it("keeps Monaco host mounted while saving", async () => {
    useEditorStore.setState({
      path: "/proj/a.ts",
      content: "hello",
      status: "saving",
    });
    render(<EditorPanel />);
    expect(await screen.findByTestId("monaco-host")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("shows saveError inline without unmounting Monaco", async () => {
    useEditorStore.setState({
      path: "/proj/a.ts",
      content: "hello",
      status: "ready",
      saveError: "disk full",
    });
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
      expect(useEditorStore.getState().dirty).toBe(false);
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
      expect(useEditorStore.getState().saveError).toBe("disk full");
    });
    expect(useShellStore.getState().activeMainCard).toBe("chat");
    expect(useEditorStore.getState().dirty).toBe(true);
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
      expect(useEditorStore.getState().dirty).toBe(false);
    });
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("edited");
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
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("hello");
  });
});
