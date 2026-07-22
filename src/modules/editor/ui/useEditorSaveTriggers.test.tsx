import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { useEditorStore } from "../state/editorStore";
import { useEditorSaveTriggers } from "./useEditorSaveTriggers";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";

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
    path: null,
    content: "",
    baselineContent: "",
    dirty: false,
    status: "idle",
    errorMessage: null,
    saveError: null,
  });
}

describe("useEditorSaveTriggers quit save", () => {
  beforeEach(() => {
    resetEditorStore();
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
    expect(useEditorStore.getState().dirty).toBe(false);
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
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(useEditorStore.getState().saveError).toBe("disk full");
    unmount();
  });
});
