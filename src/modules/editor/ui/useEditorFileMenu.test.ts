import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorFilePicker } from "../infrastructure/editorFilePicker";
import { useEditorStore } from "../state/editorStore";
import { useEditorFileMenu } from "./useEditorFileMenu";

type MenuItemOptions = {
  id?: string;
  text: string;
  action?: () => void;
};

let openAction: (() => void) | undefined;

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: {
    new: vi.fn(async () => ({
      setAsAppMenu: vi.fn(),
    })),
  },
  MenuItem: {
    new: vi.fn(async (opts: MenuItemOptions) => {
      if (opts.id === "editor-open") {
        openAction = opts.action;
      }
      return opts;
    }),
  },
  Submenu: {
    new: vi.fn(async (opts: MenuItemOptions) => opts),
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
    openAction = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Open… menu action calls openPaths with picked files", async () => {
    const openPaths = vi.spyOn(useEditorStore.getState(), "openPaths");
    const picker = createMemoryEditorFilePicker(["/proj/a.ts"]);

    renderHook(() => useEditorFileMenu(picker));

    await waitFor(() => expect(openAction).toBeDefined());

    openAction!();

    await waitFor(() => {
      expect(openPaths).toHaveBeenCalledWith(["/proj/a.ts"]);
    });
  });
});
