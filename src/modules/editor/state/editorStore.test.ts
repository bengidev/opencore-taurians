import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { useEditorStore } from "./editorStore";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const FILE_B = "/proj/b.ts";
const FILE_C = "/proj/c.ts";

function resetEditorStore(): void {
  useEditorStore.setState({
    api: null,
    projectRoot: null,
    tabs: [],
    activePath: null,
    buffers: {},
  });
}

describe("editorStore multi-tab", () => {
  beforeEach(() => {
    resetEditorStore();
  });

  it("openFile loads into a new tab and sets activePath", async () => {
    const api = createMemoryEditorApi({ files: { [FILE_A]: "hello" } });
    useEditorStore.getState().bindApi(api);

    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);

    expect(ok).toBe(true);
    const state = useEditorStore.getState();
    expect(state.tabs.map((t) => t.path)).toEqual([FILE_A]);
    expect(state.activePath).toBe(FILE_A);
    expect(state.buffers[FILE_A]?.content).toBe("hello");
    expect(state.buffers[FILE_A]?.dirty).toBe(false);
    expect(state.buffers[FILE_A]?.status).toBe("ready");
  });

  it("openFile on a new path appends without saving the dirty prior tab", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a", [FILE_B]: "file-b" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("file-a-edited");

    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);

    expect(ok).toBe(true);
    await expect(api.readFile(PROJECT_ROOT, FILE_A)).resolves.toBe("file-a");
    const state = useEditorStore.getState();
    expect(state.tabs.map((t) => t.path)).toEqual([FILE_A, FILE_B]);
    expect(state.activePath).toBe(FILE_B);
    expect(state.buffers[FILE_A]?.dirty).toBe(true);
    expect(state.buffers[FILE_A]?.content).toBe("file-a-edited");
    expect(state.buffers[FILE_B]?.content).toBe("file-b");
  });

  it("openFile on an already-open ready tab focuses and clears saveError without reload", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "file-a", [FILE_B]: "file-b" },
    });
    const readSpy = vi.spyOn(api, "readFile");
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.setState((s) => ({
      buffers: {
        ...s.buffers,
        [FILE_A]: { ...s.buffers[FILE_A]!, saveError: "disk full" },
      },
    }));
    readSpy.mockClear();

    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);

    expect(ok).toBe(true);
    expect(useEditorStore.getState().activePath).toBe(FILE_A);
    expect(useEditorStore.getState().buffers[FILE_A]?.saveError).toBeNull();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("openFile on an error tab retries load", async () => {
    const api = createMemoryEditorApi({ files: { [FILE_A]: "hello" } });
    useEditorStore.getState().bindApi(api);
    const missing = "/proj/missing.ts";
    await useEditorStore.getState().openFile(PROJECT_ROOT, missing);
    expect(useEditorStore.getState().buffers[missing]?.status).toBe("error");

    // seed the missing path so retry succeeds (memory API writeFile requires existing file)
    api.files.set(missing, "recovered");
    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, missing);

    expect(ok).toBe(true);
    expect(useEditorStore.getState().buffers[missing]?.status).toBe("ready");
    expect(useEditorStore.getState().buffers[missing]?.content).toBe("recovered");
  });

  it("setContentFromEditor dirties only the active buffer", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "a", [FILE_B]: "b" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.getState().setContentFromEditor("b-edit");

    const state = useEditorStore.getState();
    expect(state.buffers[FILE_B]?.dirty).toBe(true);
    expect(state.buffers[FILE_A]?.dirty).toBe(false);
  });

  it("save and saveIfDirty touch only the active tab", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "a", [FILE_B]: "b" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("a-edit");
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.getState().setContentFromEditor("b-edit");

    const ok = await useEditorStore.getState().save();
    expect(ok).toBe(true);
    await expect(api.readFile(PROJECT_ROOT, FILE_B)).resolves.toBe("b-edit");
    await expect(api.readFile(PROJECT_ROOT, FILE_A)).resolves.toBe("a");
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
    expect(useEditorStore.getState().buffers[FILE_B]?.dirty).toBe(false);
  });

  it("saveAllDirty saves every dirty tab in open order and activates the first failure", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "a", [FILE_B]: "b", [FILE_C]: "c" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().setContentFromEditor("a-edit");
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    useEditorStore.getState().setContentFromEditor("b-edit");
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_C);
    useEditorStore.getState().setContentFromEditor("c-edit");

    const original = api.writeFile.bind(api);
    vi.spyOn(api, "writeFile").mockImplementation(async (root, path, content) => {
      if (path === FILE_B) throw new Error("disk full");
      return original(root, path, content);
    });

    const ok = await useEditorStore.getState().saveAllDirty();
    expect(ok).toBe(false);
    const state = useEditorStore.getState();
    expect(state.activePath).toBe(FILE_B);
    expect(state.buffers[FILE_A]?.dirty).toBe(false);
    expect(state.buffers[FILE_B]?.dirty).toBe(true);
    expect(state.buffers[FILE_B]?.saveError).toBe("disk full");
    expect(state.buffers[FILE_C]?.dirty).toBe(true);
  });

  it("save and saveIfDirty return true when there is no active tab", async () => {
    expect(useEditorStore.getState().activePath).toBeNull();

    await expect(useEditorStore.getState().save()).resolves.toBe(true);
    await expect(useEditorStore.getState().saveIfDirty()).resolves.toBe(true);
  });

  it("closeTab removes tab and activates right neighbor else left", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "a", [FILE_B]: "b", [FILE_C]: "c" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_C);
    useEditorStore.getState().setActivePath(FILE_B);

    useEditorStore.getState().closeTab(FILE_B);

    const state = useEditorStore.getState();
    expect(state.tabs.map((t) => t.path)).toEqual([FILE_A, FILE_C]);
    expect(state.activePath).toBe(FILE_C);
    expect(state.buffers[FILE_B]).toBeUndefined();
  });

  it("closeTab activates left neighbor when closing the rightmost active tab", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "a", [FILE_B]: "b", [FILE_C]: "c" },
    });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_B);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_C);
    expect(useEditorStore.getState().activePath).toBe(FILE_C);

    useEditorStore.getState().closeTab(FILE_C);

    const state = useEditorStore.getState();
    expect(state.tabs.map((t) => t.path)).toEqual([FILE_A, FILE_B]);
    expect(state.activePath).toBe(FILE_B);
    expect(state.buffers[FILE_C]).toBeUndefined();
  });

  it("closeTab last tab clears activePath", async () => {
    const api = createMemoryEditorApi({ files: { [FILE_A]: "a" } });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().closeTab(FILE_A);
    expect(useEditorStore.getState().tabs).toEqual([]);
    expect(useEditorStore.getState().activePath).toBeNull();
  });

  it("load failure keeps the tab open with error status", async () => {
    const api = createMemoryEditorApi({ files: { [FILE_A]: "hello" } });
    useEditorStore.getState().bindApi(api);
    const missing = "/proj/missing.ts";
    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, missing);
    expect(ok).toBe(false);
    const buf = useEditorStore.getState().buffers[missing];
    expect(useEditorStore.getState().tabs.map((t) => t.path)).toEqual([missing]);
    expect(buf?.status).toBe("error");
    expect(buf?.errorMessage).toMatch(/not found/i);
  });
});
