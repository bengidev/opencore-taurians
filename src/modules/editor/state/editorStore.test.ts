import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import type { EditorApi } from "../api/editorApi";
import { useEditorStore } from "./editorStore";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const FILE_B = "/proj/b.ts";

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

describe("editorStore", () => {
  beforeEach(() => {
    resetEditorStore();
  });

  it("openFile loads content, dirty false, status ready", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);

    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);

    expect(ok).toBe(true);
    const state = useEditorStore.getState();
    expect(state.path).toBe(FILE_A);
    expect(state.projectRoot).toBe(PROJECT_ROOT);
    expect(state.content).toBe("hello");
    expect(state.baselineContent).toBe("hello");
    expect(state.dirty).toBe(false);
    expect(state.status).toBe("ready");
    expect(state.errorMessage).toBeNull();
  });

  it("setContentFromEditor marks dirty", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);

    useEditorStore.getState().setContentFromEditor("hello!");

    const state = useEditorStore.getState();
    expect(state.content).toBe("hello!");
    expect(state.dirty).toBe(true);
  });

  it("save writes and clears dirty", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("saved");

    const ok = await useEditorStore.getState().save();

    expect(ok).toBe(true);
    const state = useEditorStore.getState();
    expect(state.dirty).toBe(false);
    expect(state.baselineContent).toBe("saved");
    expect(state.saveError).toBeNull();
    await expect(api.readFile(PROJECT_ROOT, FILE_A)).resolves.toBe("saved");
  });

  it("dirty openFile other path saves first then loads new", async () => {
    const api = createMemoryEditorApi({
      files: {
        [FILE_A]: "file-a",
        [FILE_B]: "file-b",
      },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");

    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);

    expect(ok).toBe(true);
    await expect(api.readFile(PROJECT_ROOT, FILE_A)).resolves.toBe("file-a-edited");
    const state = useEditorStore.getState();
    expect(state.path).toBe(FILE_B);
    expect(state.content).toBe("file-b");
    expect(state.baselineContent).toBe("file-b");
    expect(state.dirty).toBe(false);
    expect(state.status).toBe("ready");
  });

  it("save-before-switch failure keeps old path and content", async () => {
    const api = createMemoryEditorApi({
      files: {
        [FILE_A]: "file-a",
        [FILE_B]: "file-b",
      },
    });
    const writeSpy = vi.spyOn(api, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");

    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);

    expect(ok).toBe(false);
    writeSpy.mockRestore();
    const state = useEditorStore.getState();
    expect(state.path).toBe(FILE_A);
    expect(state.content).toBe("file-a-edited");
    expect(state.dirty).toBe(true);
    expect(state.status).toBe("ready");
    await expect(api.readFile(PROJECT_ROOT, FILE_A)).resolves.toBe("file-a");
  });

  it("load failure sets status error and errorMessage", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "hello" },
    });
    useEditorStore.getState().bindApi(api);

    const missingPath = "/proj/missing.ts";
    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, missingPath);

    expect(ok).toBe(false);
    const state = useEditorStore.getState();
    expect(state.path).toBe(missingPath);
    expect(state.content).toBe("");
    expect(state.baselineContent).toBe("");
    expect(state.dirty).toBe(false);
    expect(state.status).toBe("error");
    expect(state.errorMessage).toMatch(/not found/i);
  });
});
