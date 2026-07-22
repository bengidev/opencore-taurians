import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { useEditorStore } from "../state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import * as saveAsPromptBridge from "./saveAsPromptBridge";
import { registerSaveAsRequestHandler } from "./saveAsPromptBridge";
import { useEditorSaveTriggers } from "./useEditorSaveTriggers";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const FILE_B = "/proj/b.ts";

type CloseHandler = (event: { preventDefault: () => void }) => void | Promise<void>;

let closeHandler: CloseHandler | undefined;
const preventDefault = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: (handler: CloseHandler) => {
      closeHandler = handler;
      return Promise.resolve(() => {
        closeHandler = undefined;
      });
    },
  }),
}));

function SaveTriggersHost() {
  useEditorSaveTriggers();
  return null;
}

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

describe("useEditorSaveTriggers quit save", () => {
  beforeEach(() => {
    resetEditorStore();
    useShellStore.setState({ activeMainCard: "chat" });
    closeHandler = undefined;
    preventDefault.mockClear();
  });

  afterEach(() => {
    closeHandler = undefined;
  });

  it("saves dirty buffer on close request", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("edited");

    const { unmount } = render(<SaveTriggersHost />);
    await vi.waitFor(() => expect(closeHandler).toBeDefined());

    const event = { preventDefault };
    await closeHandler!(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(false);
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("edited");
    unmount();
  });

  it("prevents close when quit save fails and buffer stays dirty", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    vi.spyOn(api, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("edited");

    const { unmount } = render(<SaveTriggersHost />);
    await vi.waitFor(() => expect(closeHandler).toBeDefined());

    const event = { preventDefault };
    await closeHandler!(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(useShellStore.getState().activeMainCard).toBe("editor");
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
    expect(useEditorStore.getState().buffers[FILE_A]?.saveError).toBe("disk full");
    unmount();
  });

  it("quit saves all dirty tabs", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a", [FILE_B]: "file-b" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.getState().setContentFromEditor("file-b-edited");

    const { unmount } = render(<SaveTriggersHost />);
    await vi.waitFor(() => expect(closeHandler).toBeDefined());

    const event = { preventDefault };
    await closeHandler!(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(false);
    expect(useEditorStore.getState().buffers[FILE_B]?.dirty).toBe(false);
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("file-a-edited");
    expect(await api.readFile(PROJECT_ROOT, FILE_B)).toBe("file-b-edited");
    unmount();
  });

  it("⌘S on Untitled requests Save As", async () => {
    const api = createMemoryEditorApi();
    const writeSpy = vi.spyOn(api, "writeFile");
    useEditorStore.getState().bindApi(api);
    const id = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("draft");
    useShellStore.setState({ activeMainCard: "editor" });

    const saveAsRequest = vi.fn();
    registerSaveAsRequestHandler(saveAsRequest);

    const { unmount } = render(<SaveTriggersHost />);

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    expect(saveAsRequest).toHaveBeenCalledWith(id);
    expect(writeSpy).not.toHaveBeenCalled();

    registerSaveAsRequestHandler(null);
    unmount();
  });

  it("leave on dirty Untitled does not call writeFile or createFile", async () => {
    const api = createMemoryEditorApi();
    useEditorStore.getState().bindApi(api);
    const writeSpy = vi.spyOn(api, "writeFile");
    const createSpy = vi.spyOn(api, "createFile");
    const id = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("draft");
    useShellStore.setState({ activeMainCard: "editor" });

    const saveAsRequest = vi.fn();
    registerSaveAsRequestHandler(saveAsRequest);

    const { unmount } = render(<SaveTriggersHost />);
    useShellStore.setState({ activeMainCard: "chat" });

    expect(saveAsRequest).toHaveBeenCalledWith(id);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(useShellStore.getState().activeMainCard).toBe("chat");

    registerSaveAsRequestHandler(null);
    unmount();
  });

  it("quit saves path tabs then prompts dirty Untitled", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");
    const untitledId = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("untitled-draft");

    const promptSpy = vi
      .spyOn(saveAsPromptBridge, "promptQuitUntitled")
      .mockImplementation(async (id) => {
        useEditorStore.getState().closeTab(id);
        return "discarded";
      });

    const { unmount } = render(<SaveTriggersHost />);
    await vi.waitFor(() => expect(closeHandler).toBeDefined());

    const event = { preventDefault };
    await closeHandler!(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("file-a-edited");
    expect(promptSpy).toHaveBeenCalledWith(untitledId);
    expect(useEditorStore.getState().tabs.find((t) => t.id === untitledId)).toBeUndefined();

    promptSpy.mockRestore();
    unmount();
  });

  it("quit prevents close when quit Untitled is cancelled", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    const untitledId = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("untitled-draft");

    const promptSpy = vi
      .spyOn(saveAsPromptBridge, "promptQuitUntitled")
      .mockResolvedValue("cancelled");

    const { unmount } = render(<SaveTriggersHost />);
    await vi.waitFor(() => expect(closeHandler).toBeDefined());

    const event = { preventDefault };
    await closeHandler!(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(useShellStore.getState().activeMainCard).toBe("editor");
    expect(promptSpy).toHaveBeenCalledWith(untitledId);
    expect(useEditorStore.getState().tabs.find((t) => t.id === untitledId)).toBeDefined();

    promptSpy.mockRestore();
    unmount();
  });

  it("quit prevents close when quit Untitled save fails", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    const untitledId = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("untitled-draft");

    const promptSpy = vi
      .spyOn(saveAsPromptBridge, "promptQuitUntitled")
      .mockResolvedValue("failed");

    const { unmount } = render(<SaveTriggersHost />);
    await vi.waitFor(() => expect(closeHandler).toBeDefined());

    const event = { preventDefault };
    await closeHandler!(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(useShellStore.getState().activeMainCard).toBe("editor");
    expect(promptSpy).toHaveBeenCalledWith(untitledId);
    expect(useEditorStore.getState().tabs.find((t) => t.id === untitledId)).toBeDefined();

    promptSpy.mockRestore();
    unmount();
  });

  it("quit prevents close when a dirty save fails", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a", [FILE_B]: "file-b" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.getState().setContentFromEditor("file-b-edited");
    const original = api.writeFile.bind(api);
    vi.spyOn(api, "writeFile").mockImplementation(async (root, path, content) => {
      if (path === FILE_B) {
        throw new Error("disk full");
      }
      return original(root, path, content);
    });

    const { unmount } = render(<SaveTriggersHost />);
    await vi.waitFor(() => expect(closeHandler).toBeDefined());

    const event = { preventDefault };
    await closeHandler!(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(useShellStore.getState().activeMainCard).toBe("editor");
    expect(useEditorStore.getState().activeTabId).toBe(FILE_B);
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(false);
    expect(useEditorStore.getState().buffers[FILE_B]?.dirty).toBe(true);
    expect(useEditorStore.getState().buffers[FILE_B]?.saveError).toBe("disk full");
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("file-a-edited");
    unmount();
  });
});
