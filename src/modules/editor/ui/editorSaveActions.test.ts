import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { useEditorStore } from "../state/editorStore";
import * as saveAsPromptBridge from "./saveAsPromptBridge";
import { performEditorSave, performEditorSaveAs } from "./editorSaveActions";

function resetEditorStore(): void {
  useEditorStore.setState({
    api: null,
    projectRoot: null,
    tabs: [],
    activeTabId: null,
    buffers: {},
    nextUntitled: 1,
    openBatchError: null,
  });
}

describe("editorSaveActions", () => {
  beforeEach(() => {
    resetEditorStore();
  });

  afterEach(() => {
    const { save } = useEditorStore.getState();
    if (vi.isMockFunction(save)) {
      save.mockRestore();
    }
    vi.restoreAllMocks();
  });

  it("performEditorSave no-ops without active tab", () => {
    const save = vi.spyOn(useEditorStore.getState(), "save");
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    performEditorSave();
    expect(save).not.toHaveBeenCalled();
    expect(requestSaveAs).not.toHaveBeenCalled();
  });

  it("performEditorSave requests Save As for Untitled", () => {
    useEditorStore.getState().bindApi(createMemoryEditorApi({ files: {} }));
    useEditorStore.setState({ projectRoot: "/proj" });
    const id = useEditorStore.getState().openUntitled();
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    const save = vi.spyOn(useEditorStore.getState(), "save");
    performEditorSave();
    expect(requestSaveAs).toHaveBeenCalledWith(id);
    expect(save).not.toHaveBeenCalled();
  });

  it("performEditorSave calls save for path-backed tab", async () => {
    const api = createMemoryEditorApi({ files: { "/proj/a.ts": "a" } });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    await useEditorStore.getState().openFile("/proj", "/proj/a.ts");
    const save = vi.spyOn(useEditorStore.getState(), "save");
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    performEditorSave();
    expect(save).toHaveBeenCalled();
    expect(requestSaveAs).not.toHaveBeenCalled();
  });

  it("performEditorSave no-ops for readOnly active tab", async () => {
    const api = createMemoryEditorApi({
      files: { "/tmp/out.ts": "x" },
    });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    await useEditorStore.getState().openPaths(["/tmp/out.ts"]);
    const save = vi.spyOn(useEditorStore.getState(), "save");
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    performEditorSave();
    expect(save).not.toHaveBeenCalled();
    expect(requestSaveAs).not.toHaveBeenCalled();
  });

  it("performEditorSaveAs no-ops for readOnly and requests for writable", async () => {
    const api = createMemoryEditorApi({
      files: { "/proj/a.ts": "a", "/tmp/out.ts": "x" },
    });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");

    await useEditorStore.getState().openPaths(["/tmp/out.ts"]);
    performEditorSaveAs();
    expect(requestSaveAs).not.toHaveBeenCalled();

    await useEditorStore.getState().openPaths(["/proj/a.ts"]);
    performEditorSaveAs();
    expect(requestSaveAs).toHaveBeenCalledWith("/proj/a.ts");
  });
});
