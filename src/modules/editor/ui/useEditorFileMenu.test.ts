import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { createMemoryEditorFilePicker } from "../infrastructure/editorFilePicker";
import { useEditorStore } from "../state/editorStore";
import * as saveAsPromptBridge from "./saveAsPromptBridge";
import { useEditorFileMenu } from "./useEditorFileMenu";

type MenuItemOptions = {
  id?: string;
  text: string;
  accelerator?: string;
  action?: () => void;
};

const actions: Record<string, (() => void) | undefined> = {};

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: {
    new: vi.fn(async () => ({
      setAsAppMenu: vi.fn(),
    })),
  },
  MenuItem: {
    new: vi.fn(async (opts: MenuItemOptions) => {
      if (opts.id) actions[opts.id] = opts.action;
      return opts;
    }),
  },
  Submenu: {
    new: vi.fn(async (opts: { text: string; items: unknown[] }) => opts),
  },
}));

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

describe("useEditorFileMenu", () => {
  beforeEach(() => {
    resetEditorStore();
    for (const k of Object.keys(actions)) delete actions[k];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Open… menu action calls openPaths with picked files", async () => {
    const openPaths = vi.spyOn(useEditorStore.getState(), "openPaths");
    const picker = createMemoryEditorFilePicker(["/proj/a.ts"]);
    renderHook(() => useEditorFileMenu(picker));
    await waitFor(() => expect(actions["editor-open"]).toBeDefined());
    actions["editor-open"]!();
    await waitFor(() => {
      expect(openPaths).toHaveBeenCalledWith(["/proj/a.ts"]);
    });
  });

  it("New menu action opens Untitled", async () => {
    useEditorStore.getState().bindApi(createMemoryEditorApi({ files: {} }));
    useEditorStore.setState({ projectRoot: "/proj" });
    renderHook(() => useEditorFileMenu(createMemoryEditorFilePicker([])));
    await waitFor(() => expect(actions["editor-new"]).toBeDefined());
    actions["editor-new"]!();
    expect(useEditorStore.getState().tabs[0]?.id).toBe("untitled:1");
  });

  it("Save menu action uses performEditorSave path for path-backed tab", async () => {
    const api = createMemoryEditorApi({ files: { "/proj/a.ts": "a" } });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    await useEditorStore.getState().openFile("/proj", "/proj/a.ts");
    const save = vi.spyOn(useEditorStore.getState(), "save");
    renderHook(() => useEditorFileMenu(createMemoryEditorFilePicker([])));
    await waitFor(() => expect(actions["editor-save"]).toBeDefined());
    actions["editor-save"]!();
    expect(save).toHaveBeenCalled();
  });

  it("Save As… menu action requests Save As for writable active tab", async () => {
    const api = createMemoryEditorApi({ files: { "/proj/a.ts": "a" } });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    await useEditorStore.getState().openFile("/proj", "/proj/a.ts");
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    renderHook(() => useEditorFileMenu(createMemoryEditorFilePicker([])));
    await waitFor(() => expect(actions["editor-save-as"]).toBeDefined());
    actions["editor-save-as"]!();
    expect(requestSaveAs).toHaveBeenCalledWith("/proj/a.ts");
  });

  it("Save As… menu action no-ops for readOnly active tab", async () => {
    const api = createMemoryEditorApi({ files: { "/tmp/out.ts": "x" } });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    await useEditorStore.getState().openPaths(["/tmp/out.ts"]);
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    renderHook(() => useEditorFileMenu(createMemoryEditorFilePicker([])));
    await waitFor(() => expect(actions["editor-save-as"]).toBeDefined());
    actions["editor-save-as"]!();
    expect(requestSaveAs).not.toHaveBeenCalled();
  });
});
