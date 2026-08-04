import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import { MonacoEditorHost } from "./EditorMonacoHost";

vi.mock("./editorMonacoSetup", () => ({}));

vi.mock("@monaco-editor/react", () => ({
  default: (props: { options?: { fontSize?: number } }) => (
    <div data-testid="monaco-editor" data-fontsize={props.options?.fontSize} />
  ),
}));

function seedActiveTab(id: string, content: string): void {
  useEditorStore.setState({
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
      },
    },
  });
}

describe("MonacoEditorHost", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useShellStore.setState({
      activeMainCard: "editor",
      leftVisible: true,
      rightVisible: true,
      bottomVisible: true,
      settingsOpen: false,
      leftPanelWidth: 240,
      rightPanelWidth: 240,
      explorerAutoRefresh: "live",
      editorFontSize: 13,
    });
    useEditorStore.setState({
      activeTabId: null,
      buffers: {},
      openBatchError: null,
    });
  });

  it("uses default editor font size", () => {
    seedActiveTab("/proj/a.ts", "const x = 1;");
    render(<MonacoEditorHost />);
    expect(screen.getByTestId("monaco-editor")).toHaveAttribute(
      "data-fontsize",
      "13",
    );
  });

  it("reflects custom editor font size from shell store", () => {
    useShellStore.setState({ editorFontSize: 20 });
    seedActiveTab("/proj/a.ts", "const x = 1;");
    render(<MonacoEditorHost />);
    expect(screen.getByTestId("monaco-editor")).toHaveAttribute(
      "data-fontsize",
      "20",
    );
  });
});
