import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../state/editorStore";
import { EditorPanel } from "./EditorPanel";

vi.mock("./MonacoEditorHost", () => ({
  MonacoEditorHost: () => <div data-testid="monaco-host" />,
}));

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

describe("EditorPanel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
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
});
