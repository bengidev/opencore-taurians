import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import type { EditorBuffer } from "../state/editorStore";
import { useEditorStore } from "../state/editorStore";
import { EditorCloseTabDialog } from "./EditorCloseTabDialog";

const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";

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

function seedBuffer(path: string, extras?: Partial<EditorBuffer>): EditorBuffer {
  return {
    content: "edited",
    baselineContent: "hello",
    dirty: true,
    status: "ready",
    errorMessage: null,
    saveError: null,
    ...extras,
  };
}

function seedDirtyTab(): void {
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: FILE_A }],
    activeTabId: FILE_A,
    buffers: { [FILE_A]: seedBuffer(FILE_A) },
  });
}

function DialogHarness({
  initialId,
  onOpenChangeSpy,
}: {
  initialId: string;
  onOpenChangeSpy: (open: boolean) => void;
}): ReactNode {
  const [id, setId] = useState<string | null>(initialId);

  return (
    <EditorCloseTabDialog
      id={id}
      onOpenChange={(open) => {
        onOpenChangeSpy(open);
        if (!open) {
          setId(null);
        }
      }}
    />
  );
}

describe("EditorCloseTabDialog", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    resetEditorStore();
  });

  it("Save saves then closes on success", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi({ files: { [FILE_A]: "hello" } });
    useEditorStore.getState().bindApi(api);
    seedDirtyTab();
    const onOpenChange = vi.fn();

    render(
      <DialogHarness initialId={FILE_A} onOpenChangeSpy={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(useEditorStore.getState().tabs).toEqual([]);
    });
    expect(await api.readFile(PROJECT_ROOT, FILE_A)).toBe("edited");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Save failure keeps tab and dialog open with saveError", async () => {
    const user = userEvent.setup();
    const api = createMemoryEditorApi({ files: { [FILE_A]: "hello" } });
    vi.spyOn(api, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    useEditorStore.getState().bindApi(api);
    seedDirtyTab();
    const onOpenChange = vi.fn();

    render(
      <DialogHarness initialId={FILE_A} onOpenChangeSpy={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("disk full")).toBeInTheDocument();
    });
    expect(useEditorStore.getState().tabs).toEqual([{ id: FILE_A }]);
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Don't save discards and closes", async () => {
    const user = userEvent.setup();
    seedDirtyTab();
    const onOpenChange = vi.fn();

    render(
      <DialogHarness initialId={FILE_A} onOpenChangeSpy={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: /don't save/i }));

    expect(useEditorStore.getState().tabs).toEqual([]);
    expect(useEditorStore.getState().buffers[FILE_A]).toBeUndefined();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancel keeps tab open", async () => {
    const user = userEvent.setup();
    seedDirtyTab();
    const onOpenChange = vi.fn();

    render(
      <DialogHarness initialId={FILE_A} onOpenChangeSpy={onOpenChange} />,
    );

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(useEditorStore.getState().tabs).toEqual([{ id: FILE_A }]);
    expect(useEditorStore.getState().buffers[FILE_A]?.dirty).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
