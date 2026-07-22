import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { useEditorStore } from "./editorStore";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const FILE_B = "/proj/b.ts";
const FILE_C = "/proj/c.ts";
const OUTSIDE = "/tmp/outside.ts";

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

describe("editorStore multi-tab", () => {
  beforeEach(() => {
    resetEditorStore();
  });

  it("openFile loads into a new tab and sets activeTabId", async () => {
    const api = createMemoryEditorApi({ files: { [FILE_A]: "hello" } });
    useEditorStore.getState().bindApi(api);

    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);

    expect(ok).toBe(true);
    const state = useEditorStore.getState();
    expect(state.tabs.map((t) => t.id)).toEqual([FILE_A]);
    expect(state.activeTabId).toBe(FILE_A);
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
    expect(state.tabs.map((t) => t.id)).toEqual([FILE_A, FILE_B]);
    expect(state.activeTabId).toBe(FILE_B);
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
    expect(useEditorStore.getState().activeTabId).toBe(FILE_A);
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

  it("saveAllDirtyPaths saves every dirty tab in open order and activates the first failure", async () => {
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

    const ok = await useEditorStore.getState().saveAllDirtyPaths();
    expect(ok).toBe(false);
    const state = useEditorStore.getState();
    expect(state.activeTabId).toBe(FILE_B);
    expect(state.buffers[FILE_A]?.dirty).toBe(false);
    expect(state.buffers[FILE_B]?.dirty).toBe(true);
    expect(state.buffers[FILE_B]?.saveError).toBe("disk full");
    expect(state.buffers[FILE_C]?.dirty).toBe(true);
  });

  it("save and saveIfDirty return true when there is no active tab", async () => {
    expect(useEditorStore.getState().activeTabId).toBeNull();

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
    useEditorStore.getState().setActiveTabId(FILE_B);

    useEditorStore.getState().closeTab(FILE_B);

    const state = useEditorStore.getState();
    expect(state.tabs.map((t) => t.id)).toEqual([FILE_A, FILE_C]);
    expect(state.activeTabId).toBe(FILE_C);
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
    expect(useEditorStore.getState().activeTabId).toBe(FILE_C);

    useEditorStore.getState().closeTab(FILE_C);

    const state = useEditorStore.getState();
    expect(state.tabs.map((t) => t.id)).toEqual([FILE_A, FILE_B]);
    expect(state.activeTabId).toBe(FILE_B);
    expect(state.buffers[FILE_C]).toBeUndefined();
  });

  it("closeTab last tab clears activeTabId", async () => {
    const api = createMemoryEditorApi({ files: { [FILE_A]: "a" } });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile(PROJECT_ROOT, FILE_A);
    useEditorStore.getState().closeTab(FILE_A);
    expect(useEditorStore.getState().tabs).toEqual([]);
    expect(useEditorStore.getState().activeTabId).toBeNull();
  });

  it("load failure keeps the tab open with error status", async () => {
    const api = createMemoryEditorApi({ files: { [FILE_A]: "hello" } });
    useEditorStore.getState().bindApi(api);
    const missing = "/proj/missing.ts";
    const ok = await useEditorStore.getState().openFile(PROJECT_ROOT, missing);
    expect(ok).toBe(false);
    const buf = useEditorStore.getState().buffers[missing];
    expect(useEditorStore.getState().tabs.map((t) => t.id)).toEqual([missing]);
    expect(buf?.status).toBe("error");
    expect(buf?.errorMessage).toMatch(/not found/i);
  });

  it("openUntitled appends untitled:N clean ready buffer", () => {
    useEditorStore.getState().bindApi(createMemoryEditorApi());
    useEditorStore.setState({ projectRoot: "/proj" });
    const id = useEditorStore.getState().openUntitled();
    expect(id).toBe("untitled:1");
    const s = useEditorStore.getState();
    expect(s.tabs.map((t) => t.id)).toEqual(["untitled:1"]);
    expect(s.activeTabId).toBe("untitled:1");
    expect(s.buffers[id]).toMatchObject({
      content: "",
      baselineContent: "",
      dirty: false,
      status: "ready",
      readOnly: false,
    });
    expect(s.nextUntitled).toBe(2);
  });

  it("saveAs retargets untitled to path via createFile", async () => {
    const api = createMemoryEditorApi();
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    const id = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("hello");
    const ok = await useEditorStore.getState().saveAs(id, "/proj/hello.txt");
    expect(ok).toBe(true);
    const s = useEditorStore.getState();
    expect(s.tabs.map((t) => t.id)).toEqual(["/proj/hello.txt"]);
    expect(s.activeTabId).toBe("/proj/hello.txt");
    expect(s.buffers["untitled:1"]).toBeUndefined();
    expect(s.buffers["/proj/hello.txt"]).toMatchObject({
      content: "hello",
      dirty: false,
      status: "ready",
    });
    expect(api.files.get("/proj/hello.txt")).toBe("hello");
  });

  it("saveAs closes colliding open path tab", async () => {
    const api = createMemoryEditorApi({ files: { "/proj/a.txt": "disk" } });
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile("/proj", "/proj/a.txt");
    useEditorStore.setState({ projectRoot: "/proj" });
    const id = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("winner");
    await useEditorStore.getState().saveAs(id, "/proj/a.txt");
    const s = useEditorStore.getState();
    expect(s.tabs.map((t) => t.id)).toEqual(["/proj/a.txt"]);
    expect(s.buffers["/proj/a.txt"]?.content).toBe("winner");
  });

  it("saveTab and saveAllDirtyPaths skip Untitled", async () => {
    const api = createMemoryEditorApi({ files: { "/proj/a.txt": "a" } });
    const writeSpy = vi.spyOn(api, "writeFile");
    useEditorStore.getState().bindApi(api);
    await useEditorStore.getState().openFile("/proj", "/proj/a.txt");
    useEditorStore.getState().setContentFromEditor("a2");
    useEditorStore.setState({ projectRoot: "/proj" });
    const u = useEditorStore.getState().openUntitled();
    useEditorStore.getState().setContentFromEditor("u");
    expect(await useEditorStore.getState().saveTab(u)).toBe(false);
    expect(await useEditorStore.getState().saveAllDirtyPaths()).toBe(true);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().buffers[u]?.dirty).toBe(true);
  });
});

describe("editorStore openPaths", () => {
  beforeEach(() => {
    resetEditorStore();
  });

  it("openPaths opens under-root as writable and outside as readOnly", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "a", [OUTSIDE]: "out" },
    });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });

    const ok = await useEditorStore.getState().openPaths([FILE_A, OUTSIDE]);
    expect(ok).toBe(true);
    const { buffers, activeTabId, tabs } = useEditorStore.getState();
    expect(tabs.map((t) => t.id)).toEqual([FILE_A, OUTSIDE]);
    expect(buffers[FILE_A]?.readOnly).toBe(false);
    expect(buffers[OUTSIDE]?.readOnly).toBe(true);
    expect(buffers[OUTSIDE]?.content).toBe("out");
    expect(activeTabId).toBe(OUTSIDE);
  });

  it("openPaths aborts entirely when any path is a directory", async () => {
    const api = createMemoryEditorApi({
      files: { [FILE_A]: "a" },
      directories: ["/tmp/folder"],
    });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });

    const ok = await useEditorStore.getState().openPaths([FILE_A, "/tmp/folder"]);
    expect(ok).toBe(false);
    expect(useEditorStore.getState().tabs).toEqual([]);
    expect(useEditorStore.getState().openBatchError).toBe("Folders can't be opened here");
  });

  it("openPaths without projectRoot sets error and opens nothing", async () => {
    const api = createMemoryEditorApi({ files: { [OUTSIDE]: "x" } });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: null });

    const ok = await useEditorStore.getState().openPaths([OUTSIDE]);
    expect(ok).toBe(false);
    expect(useEditorStore.getState().openBatchError).toBe("Open a project first");
    expect(useEditorStore.getState().tabs).toEqual([]);
  });

  it("saveTab on readOnly tab does not call writeFile", async () => {
    const api = createMemoryEditorApi({ files: { [OUTSIDE]: "out" } });
    const writeSpy = vi.spyOn(api, "writeFile");
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    await useEditorStore.getState().openPaths([OUTSIDE]);
    await expect(useEditorStore.getState().saveTab(OUTSIDE)).resolves.toBe(false);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("saveAs on readOnly tab does not call createFile", async () => {
    const api = createMemoryEditorApi({ files: { [OUTSIDE]: "out" } });
    const createSpy = vi.spyOn(api, "createFile");
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    await useEditorStore.getState().openPaths([OUTSIDE]);
    await expect(
      useEditorStore.getState().saveAs(OUTSIDE, "/proj/new.ts"),
    ).resolves.toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("setContentFromEditor no-ops for readOnly active tab", async () => {
    const api = createMemoryEditorApi({ files: { [OUTSIDE]: "out" } });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    await useEditorStore.getState().openPaths([OUTSIDE]);
    useEditorStore.getState().setContentFromEditor("hacked");
    expect(useEditorStore.getState().buffers[OUTSIDE]?.content).toBe("out");
    expect(useEditorStore.getState().buffers[OUTSIDE]?.dirty).toBe(false);
  });
});
