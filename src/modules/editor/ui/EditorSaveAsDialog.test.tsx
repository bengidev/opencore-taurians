import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import type { EditorBuffer } from "../state/editorStore";
import { useEditorStore } from "../state/editorStore";
import { EditorSaveAsDialog } from "./EditorSaveAsDialog";

const PROJECT_ROOT = "/proj";
const SUBDIR = "/proj/src";

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

function seedUntitled(dirty = true): string {
  const id = "untitled:1";
  const buffer: EditorBuffer = {
    content: dirty ? "hello" : "",
    baselineContent: "",
    dirty,
    status: "ready",
    errorMessage: null,
    saveError: null,
    readOnly: false,
  };
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id }],
    activeTabId: id,
    buffers: { [id]: buffer },
    nextUntitled: 2,
  });
  return id;
}

function DialogHarness({
  initialSourceId,
  listSubdirs,
  onOpenChangeSpy,
  onSuccess,
}: {
  initialSourceId: string;
  listSubdirs: (projectRoot: string, dir: string) => Promise<string[]>;
  onOpenChangeSpy: (open: boolean) => void;
  onSuccess?: (savedPath: string) => void;
}): ReactNode {
  const [sourceId, setSourceId] = useState<string | null>(initialSourceId);

  return (
    <EditorSaveAsDialog
      sourceId={sourceId}
      listSubdirs={listSubdirs}
      onSuccess={onSuccess}
      onOpenChange={(open) => {
        onOpenChangeSpy(open);
        if (!open) {
          setSourceId(null);
        }
      }}
    />
  );
}

describe("EditorSaveAsDialog", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
  });

  const listSubdirs = vi.fn(async (_root: string, dir: string) => {
    if (dir === PROJECT_ROOT) return ["src"];
    return [];
  });

  it("shows validation when filename is empty", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi();
    useEditorStore.getState().bindApi(api);
    const id = seedUntitled();
    const saveAsSpy = vi.spyOn(useEditorStore.getState(), "saveAs");
    const onOpenChange = vi.fn();

    render(
      <DialogHarness
        initialSourceId={id}
        listSubdirs={listSubdirs}
        onOpenChangeSpy={onOpenChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByText(/enter a file name/i)).toBeInTheDocument();
    expect(saveAsSpy).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("Save calls saveAs with joined path", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi();
    useEditorStore.getState().bindApi(api);
    const id = seedUntitled();
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <DialogHarness
        initialSourceId={id}
        listSubdirs={listSubdirs}
        onOpenChangeSpy={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^src$/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^src$/i }));
    await user.type(screen.getByLabelText(/file name/i), "hello.ts");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(onSuccess).toHaveBeenCalledWith(`${SUBDIR}/hello.ts`);
    expect(await api.readFile(PROJECT_ROOT, `${SUBDIR}/hello.ts`)).toBe("hello");
    expect(useEditorStore.getState().tabs).toEqual([{ id: `${SUBDIR}/hello.ts` }]);
  });

  it("shows overwrite confirm when target file exists", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi({
      files: { [`${PROJECT_ROOT}/exists.ts`]: "old" },
    });
    useEditorStore.getState().bindApi(api);
    const id = seedUntitled();
    const onOpenChange = vi.fn();

    render(
      <DialogHarness
        initialSourceId={id}
        listSubdirs={listSubdirs}
        onOpenChangeSpy={onOpenChange}
      />,
    );

    await user.type(screen.getByLabelText(/file name/i), "exists.ts");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByText(/replace existing file/i)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: /^replace$/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(await api.readFile(PROJECT_ROOT, `${PROJECT_ROOT}/exists.ts`)).toBe(
      "hello",
    );
  });

  it("failure keeps dialog open with saveError", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi();
    vi.spyOn(api, "createFile").mockRejectedValueOnce(new Error("disk full"));
    useEditorStore.getState().bindApi(api);
    const id = seedUntitled();
    const onOpenChange = vi.fn();

    render(
      <DialogHarness
        initialSourceId={id}
        listSubdirs={listSubdirs}
        onOpenChangeSpy={onOpenChange}
      />,
    );

    await user.type(screen.getByLabelText(/file name/i), "new.ts");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("disk full")).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useEditorStore.getState().tabs).toEqual([{ id }]);
  });
});
