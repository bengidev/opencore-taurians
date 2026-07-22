# Editor Card File Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dragging a file from the in-app Explorer or OS Finder onto anywhere on the Editor main card opens it as an editor tab (folder-in-batch still aborts with brief error).

**Architecture:** Introduce `EditorDropZone` that wraps `EditorCardHeader` + `EditorPanel`, owns `data-editor-drop-zone`, HTML5 Explorer MIME handlers, OS drop hook + highlight, and focuses the Editor main card on successful open. Remove strip-only drop zone/handlers. `useEditorOsFileDrop` hit-test contract unchanged.

**Tech Stack:** React 19, Zustand, Vitest, Testing Library, Bun tests.

**Spec:** `docs/specs/2026-07-22-editor-card-file-drop-design.md`

## Global Constraints

- Drop target: entire Editor main card (tab strip + Monaco / empty / loading / error).
- Sources: in-app Explorer MIME **and** OS / Finder drops.
- Explorer MIME open: `openFile(projectRoot, path)` (writable under-root).
- OS open: `openPaths(paths)` (under-root writable; outside read-only).
- Any directory in OS batch → abort; brief `openBatchError`; open nothing.
- No `projectRoot` → brief error; open nothing (existing).
- On successful open → `setActiveMainCard("editor")` if not already active.
- Package manager / tests: **Bun** — `bunx vitest run …`.
- Domain language: shell **main cards** ≠ file **tabs**.
- No `@tauri-apps/plugin-fs` in `src/modules/*`.
- Out of scope: Chat/Terminal drops, Explorer folder drag, classify-on-open changes, new Tauri APIs, tab reorder.

---

## File structure

| Path | Role |
| ---- | ---- |
| `src/modules/editor/ui/EditorDropZone.tsx` | Card wrapper: zone attr, MIME handlers, OS hook, highlight, focus Editor |
| `src/modules/editor/ui/EditorDropZone.test.tsx` | MIME drop on body; OS drop focuses Editor; highlight |
| `src/modules/editor/ui/EditorTabStrip.tsx` | Remove drop zone / MIME handlers / `osDropActive` |
| `src/modules/editor/ui/EditorTabStrip.test.tsx` | Remove strip MIME drop test (moved) |
| `src/modules/editor/ui/EditorCardHeader.tsx` | Remove `useEditorOsFileDrop` / `osDropActive` plumbing |
| `src/modules/shell/ui/panels/shellMainPanel.tsx` | Wrap editor header+panel in `EditorDropZone` |

---

### Task 1: EditorDropZone (MIME + OS + focus)

**Files:**
- Create: `src/modules/editor/ui/EditorDropZone.tsx`
- Create: `src/modules/editor/ui/EditorDropZone.test.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.test.tsx`
- Modify: `src/modules/editor/ui/EditorCardHeader.tsx`
- Modify: `src/modules/shell/ui/panels/shellMainPanel.tsx`

**Interfaces:**
- Consumes: `EXPLORER_FILE_PATH_MIME` / `getExplorerFileDragPath` from `../dnd/explorerFileDrag`; `useEditorStore.openFile` / `openPaths`; `useShellStore.setActiveMainCard`; `useEditorOsFileDrop`
- Produces: `EditorDropZone({ children: React.ReactNode })` — root element with `data-editor-drop-zone=""` wrapping children

- [ ] **Step 1: Write failing `EditorDropZone` tests**

Create `EditorDropZone.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLORER_FILE_PATH_MIME,
  setExplorerFileDragData,
} from "../dnd/explorerFileDrag";
import { useEditorStore } from "../state/editorStore";
import { useShellStore } from "../../shell/state/shellStore";
import { EditorDropZone } from "./EditorDropZone";

const PROJECT_ROOT = "/proj";
const FILE_C = "/proj/c.ts";

type DropHandler = (event: {
  payload: { paths: string[]; x: number; y: number };
}) => void;

let dropHandler: DropHandler | undefined;

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, handler: DropHandler) => {
    if (eventName === "explorer://drop") {
      dropHandler = handler;
    }
    return () => {
      if (eventName === "explorer://drop") dropHandler = undefined;
    };
  }),
}));

function createExplorerFileDataTransfer(path: string): DataTransfer {
  const store: Record<string, string> = {};
  const dt = {
    types: [EXPLORER_FILE_PATH_MIME],
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? "",
  } as unknown as DataTransfer;
  setExplorerFileDragData(dt, path);
  return dt;
}

function resetStores(): void {
  useEditorStore.setState({
    api: null,
    projectRoot: null,
    tabs: [],
    activeTabId: null,
    buffers: {},
    nextUntitled: 1,
    openBatchError: null,
  });
  useShellStore.setState({ activeMainCard: "chat" });
}

describe("EditorDropZone", () => {
  beforeEach(() => {
    resetStores();
    dropHandler = undefined;
    document.elementFromPoint = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("Explorer MIME drop on panel body calls openFile and focuses Editor card", async () => {
    useEditorStore.setState({ projectRoot: PROJECT_ROOT });
    const openFile = vi
      .spyOn(useEditorStore.getState(), "openFile")
      .mockResolvedValue(true);

    render(
      <EditorDropZone>
        <div data-testid="panel-body">body</div>
      </EditorDropZone>,
    );

    const body = screen.getByTestId("panel-body");
    const dataTransfer = createExplorerFileDataTransfer(FILE_C);
    fireEvent.dragOver(body, { dataTransfer });
    fireEvent.drop(body, { dataTransfer });

    expect(openFile).toHaveBeenCalledWith(PROJECT_ROOT, FILE_C);
    expect(useShellStore.getState().activeMainCard).toBe("editor");
  });

  it("OS drop hitting panel body calls openPaths and focuses Editor card", async () => {
    const openPaths = vi
      .spyOn(useEditorStore.getState(), "openPaths")
      .mockResolvedValue(true);

    render(
      <EditorDropZone>
        <div data-testid="panel-body">body</div>
      </EditorDropZone>,
    );

    const body = screen.getByTestId("panel-body");
    vi.mocked(document.elementFromPoint).mockReturnValue(body);

    await vi.waitFor(() => expect(dropHandler).toBeDefined());

    dropHandler!({
      payload: { paths: ["/tmp/a.ts"], x: 10, y: 20 },
    });

    await vi.waitFor(() => {
      expect(openPaths).toHaveBeenCalledWith(["/tmp/a.ts"]);
    });
    expect(useShellStore.getState().activeMainCard).toBe("editor");
  });

  it("marks the zone with data-editor-drop-zone", () => {
    const { container } = render(
      <EditorDropZone>
        <div>child</div>
      </EditorDropZone>,
    );
    expect(container.querySelector("[data-editor-drop-zone]")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/EditorDropZone.test.tsx`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `EditorDropZone` and rewire callers**

Create `EditorDropZone.tsx`:

```tsx
import { useState, type DragEvent, type ReactNode } from "react";
import { useShellStore } from "../../shell/state/shellStore";
import {
  EXPLORER_FILE_PATH_MIME,
  getExplorerFileDragPath,
} from "../dnd/explorerFileDrag";
import { useEditorStore } from "../state/editorStore";
import { useEditorOsFileDrop } from "./useEditorOsFileDrop";

function focusEditorCard(): void {
  const { activeMainCard, setActiveMainCard } = useShellStore.getState();
  if (activeMainCard !== "editor") {
    setActiveMainCard("editor");
  }
}

export function EditorDropZone({ children }: { children: ReactNode }) {
  const [mimeDropActive, setMimeDropActive] = useState(false);
  const [osDropActive, setOsDropActive] = useState(false);

  useEditorOsFileDrop({
    setOsDropActive,
    onDropPaths: async (paths) => {
      const ok = await useEditorStore.getState().openPaths(paths);
      if (ok) {
        focusEditorCard();
      }
      return ok;
    },
  });

  const hasExplorerFileMime = (dataTransfer: DataTransfer): boolean =>
    dataTransfer.types.includes(EXPLORER_FILE_PATH_MIME);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasExplorerFileMime(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setMimeDropActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setMimeDropActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasExplorerFileMime(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    setMimeDropActive(false);

    const path = getExplorerFileDragPath(event.dataTransfer);
    const projectRoot = useEditorStore.getState().projectRoot;
    if (!path || !projectRoot) {
      return;
    }

    void useEditorStore.getState().openFile(projectRoot, path);
    focusEditorCard();
  };

  return (
    <div
      data-editor-drop-zone=""
      data-drop-active={mimeDropActive || osDropActive || undefined}
      className="flex min-h-0 min-w-0 flex-1 flex-col data-[drop-active]:rounded-[6px] data-[drop-active]:bg-muted/60"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
```

In `EditorTabStrip.tsx`:
1. Remove imports of `EXPLORER_FILE_PATH_MIME`, `getExplorerFileDragPath`.
2. Remove `osDropActive` prop from `EditorTabStripProps` and the component.
3. Remove `dropActive` state and all `handleDragOver` / `handleDragLeave` / `handleDrop` / `hasExplorerFileMime`.
4. Remove `openFile`, `projectRoot`, `activeMainCard`, `setActiveMainCard` usages that existed only for drop (keep `openUntitled` / tab UI).
5. On the tablist root: remove `data-editor-drop-zone`, `data-drop-active`, `onDragOver`, `onDragLeave`, `onDrop`, and drop-active className bits — keep the tablist layout classes.

In `EditorCardHeader.tsx`:
1. Remove `useEditorOsFileDrop` import and call.
2. Remove `osDropActive` state.
3. Stop passing `osDropActive` to `EditorTabStrip`.

In `shellMainPanel.tsx`, for the editor card branch:

```tsx
import { EditorDropZone } from "../../../editor/ui/EditorDropZone";
// ...
{card === "editor" ? (
  <EditorDropZone>
    <EditorCardHeader />
    <EditorPanel />
  </EditorDropZone>
) : (
  <>
    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
      {card}
    </p>
    {card === "chat" ? (
      <ChatCard />
    ) : (
      <input
        aria-label={`${card}-dummy-note`}
        className="mt-2 w-full rounded-[6px] border border-border bg-transparent px-2 py-1 text-sm"
      />
    )}
  </>
)}
```

Restructure the map body so non-editor cards keep their previous header + body layout; editor uses only `EditorDropZone` children (header already provides the strip). Remove the old separate `{card === "editor" ? <EditorCardHeader /> : …}` / `{card === "editor" ? <EditorPanel /> : …}` split.

In `EditorTabStrip.test.tsx`: delete the test `drop of explorer file MIME calls openFile` and unused helpers/imports that become dead (`createExplorerFileDataTransfer`, `EXPLORER_FILE_PATH_MIME`, `setExplorerFileDragData`, `FILE_C` if unused).

- [ ] **Step 4: Run focused tests — expect PASS**

```bash
bunx vitest run src/modules/editor/ui/EditorDropZone.test.tsx \
  src/modules/editor/ui/EditorTabStrip.test.tsx \
  src/modules/editor/ui/EditorCardHeader.test.tsx \
  src/modules/editor/ui/useEditorOsFileDrop.test.tsx \
  src/modules/explorer/ui/ExplorerPanel.test.tsx
```

Expected: PASS (ExplorerPanel skip-copy still finds `[data-editor-drop-zone]` when present in its own test fixture).

Then: `bunx vitest run src/modules/editor src/modules/shell` — all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/EditorDropZone.tsx \
  src/modules/editor/ui/EditorDropZone.test.tsx \
  src/modules/editor/ui/EditorTabStrip.tsx \
  src/modules/editor/ui/EditorTabStrip.test.tsx \
  src/modules/editor/ui/EditorCardHeader.tsx \
  src/modules/shell/ui/panels/shellMainPanel.tsx
git commit -m "$(cat <<'EOF'
Open editor tabs from file drops anywhere on the Editor card.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| Drop target = whole Editor card | 1 |
| In-app Explorer MIME → `openFile` | 1 |
| OS / Finder → `openPaths` | 1 |
| Folder in batch → abort + error | — (existing `openPaths`; covered by store tests) |
| No `projectRoot` → brief error | — (existing) |
| Focus Editor main card on success | 1 |
| Drop highlight on card | 1 |
| Chat/Terminal not a drop target | 1 (zone only on editor branch) |
| Explorer skip-copy when zone hit | 1 (attr preserved) |
| No strip-only zone | 1 |

---

## Self-review notes

- Spec coverage mapped above; folder abort left to existing `openPaths` tests (no duplicate).
- No placeholders; `EditorDropZone` API and shell wiring are fully specified.
- `openFile` / `openPaths` / `setActiveMainCard` names match current stores.
