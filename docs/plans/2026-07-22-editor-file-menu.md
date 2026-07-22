# Editor File Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Native File menu (next to OpenCore Taurians) offers New / Open… / Save / Save As…; remove the strip Open… button so discovery lives on File.

**Architecture:** Expand `useEditorFileMenu` with four items. Extract a tiny shared save helper so File → Save and the existing window ⌘S path stay identical. Strip keeps `+` and tab context menus; empty-state copy points at File → Open….

**Tech Stack:** React 19, Zustand, Vitest, Testing Library, Tauri 2 `@tauri-apps/api/menu`, Bun tests.

**Spec:** `docs/specs/2026-07-22-editor-file-menu-design.md`

## Global Constraints

- Native **File** only (no Edit/View in this change).
- Strip **Open…** removed; strip **`+`** and per-tab context Save / Save As… kept.
- New → `openUntitled()`; Open… → picker → `openPaths` (brief `openBatchError` when no `projectRoot`).
- Save → same as today’s ⌘S: Untitled → `requestSaveAs(activeTabId)`; else `save()`; no active tab / `readOnly` → no-op.
- Save As… → `requestSaveAs(activeTabId)` when active tab exists and is not `readOnly`; otherwise no-op.
- Accelerators: New `CmdOrCtrl+N`, Open… `CmdOrCtrl+O`, Save `CmdOrCtrl+S`, Save As… `CmdOrCtrl+Shift+S`.
- No Save As from RO tabs into project; no `@tauri-apps/plugin-fs` in `src/modules/*`.
- Package manager / tests: **Bun** — `bunx vitest run …`.
- Domain language: shell **main cards** ≠ file **tabs**.

---

## File structure

| Path | Role |
| ---- | ---- |
| `src/modules/editor/ui/editorSaveActions.ts` | Shared `performEditorSave` / `performEditorSaveAs` |
| `src/modules/editor/ui/editorSaveActions.test.ts` | Helper unit tests |
| `src/modules/editor/ui/useEditorSaveTriggers.ts` | ⌘S uses shared helper |
| `src/modules/editor/ui/useEditorFileMenu.ts` | Full File menu items |
| `src/modules/editor/ui/useEditorFileMenu.test.ts` | Menu action tests |
| `src/modules/editor/ui/EditorTabStrip.tsx` | Remove Open… + `filePicker` |
| `src/modules/editor/ui/EditorTabStrip.test.tsx` | Drop Open… test |
| `src/modules/editor/ui/EditorPanel.tsx` | Empty-state copy |
| `src/modules/editor/ui/EditorPanel.test.tsx` | Empty-state assertion (if tightened) |
| `src/modules/editor/CONTEXT.md` | Discoverability wording |

---

### Task 1: Shared save actions helper

**Files:**
- Create: `src/modules/editor/ui/editorSaveActions.ts`
- Create: `src/modules/editor/ui/editorSaveActions.test.ts`
- Modify: `src/modules/editor/ui/useEditorSaveTriggers.ts`

**Interfaces:**
- Consumes: `useEditorStore.getState()`, `isUntitledId`, `requestSaveAs` from `saveAsPromptBridge`
- Produces:
  - `performEditorSave(): void` — no active / readOnly → return; Untitled → `requestSaveAs(id)`; else `void save()`
  - `performEditorSaveAs(): void` — no active / readOnly → return; else `requestSaveAs(activeTabId)`

- [ ] **Step 1: Write failing tests for the helpers**

Create `editorSaveActions.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEditorApi } from "../api/createMemoryEditorApi";
import { useEditorStore } from "../state/editorStore";
import * as saveAsPromptBridge from "./saveAsPromptBridge";
import { performEditorSave, performEditorSaveAs } from "./editorSaveActions";

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

describe("editorSaveActions", () => {
  beforeEach(() => {
    resetEditorStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("performEditorSave no-ops without active tab", () => {
    const save = vi.spyOn(useEditorStore.getState(), "save");
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    performEditorSave();
    expect(save).not.toHaveBeenCalled();
    expect(requestSaveAs).not.toHaveBeenCalled();
  });

  it("performEditorSave requests Save As for Untitled", () => {
    useEditorStore.getState().bindApi(createMemoryEditorApi({ files: {} }));
    useEditorStore.setState({ projectRoot: "/proj" });
    const id = useEditorStore.getState().openUntitled();
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    const save = vi.spyOn(useEditorStore.getState(), "save");
    performEditorSave();
    expect(requestSaveAs).toHaveBeenCalledWith(id);
    expect(save).not.toHaveBeenCalled();
  });

  it("performEditorSave calls save for path-backed tab", () => {
    const api = createMemoryEditorApi({ files: { "/proj/a.ts": "a" } });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    void useEditorStore.getState().openFile("/proj/a.ts");
    const save = vi.spyOn(useEditorStore.getState(), "save");
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    performEditorSave();
    expect(save).toHaveBeenCalled();
    expect(requestSaveAs).not.toHaveBeenCalled();
  });

  it("performEditorSave no-ops for readOnly active tab", async () => {
    const api = createMemoryEditorApi({
      files: { "/tmp/out.ts": "x" },
    });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    await useEditorStore.getState().openPaths(["/tmp/out.ts"]);
    const save = vi.spyOn(useEditorStore.getState(), "save");
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");
    performEditorSave();
    expect(save).not.toHaveBeenCalled();
    expect(requestSaveAs).not.toHaveBeenCalled();
  });

  it("performEditorSaveAs no-ops for readOnly and requests for writable", async () => {
    const api = createMemoryEditorApi({
      files: { "/proj/a.ts": "a", "/tmp/out.ts": "x" },
    });
    useEditorStore.getState().bindApi(api);
    useEditorStore.setState({ projectRoot: "/proj" });
    const requestSaveAs = vi.spyOn(saveAsPromptBridge, "requestSaveAs");

    await useEditorStore.getState().openPaths(["/tmp/out.ts"]);
    performEditorSaveAs();
    expect(requestSaveAs).not.toHaveBeenCalled();

    await useEditorStore.getState().openPaths(["/proj/a.ts"]);
    performEditorSaveAs();
    expect(requestSaveAs).toHaveBeenCalledWith("/proj/a.ts");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/editorSaveActions.test.ts`

Expected: FAIL (module missing / exports missing).

- [ ] **Step 3: Implement helpers**

Create `editorSaveActions.ts`:

```ts
import { isUntitledId } from "../state/editorTabId";
import { useEditorStore } from "../state/editorStore";
import { requestSaveAs } from "./saveAsPromptBridge";

export function performEditorSave(): void {
  const { activeTabId, buffers, save } = useEditorStore.getState();
  if (!activeTabId) return;
  const buffer = buffers[activeTabId];
  if (!buffer || buffer.readOnly) return;
  if (isUntitledId(activeTabId)) {
    requestSaveAs(activeTabId);
    return;
  }
  void save();
}

export function performEditorSaveAs(): void {
  const { activeTabId, buffers } = useEditorStore.getState();
  if (!activeTabId) return;
  const buffer = buffers[activeTabId];
  if (!buffer || buffer.readOnly) return;
  requestSaveAs(activeTabId);
}
```

- [ ] **Step 4: Wire ⌘S to the helper**

In `useEditorSaveTriggers.ts`, replace the ⌘S branch body with:

```ts
import { performEditorSave } from "./editorSaveActions";
// ...
if (!mod || event.key.toLowerCase() !== "s") return;
if (useShellStore.getState().activeMainCard !== "editor") return;
event.preventDefault();
performEditorSave();
```

Remove the local Untitled / `save()` branching that this replaces (leave leave-card and quit handlers unchanged). Keep the `isUntitledId` / `requestSaveAs` / `promptQuitUntitled` imports only if still needed by leave/quit.

- [ ] **Step 5: Run tests — expect PASS**

Run:

```bash
bunx vitest run src/modules/editor/ui/editorSaveActions.test.ts src/modules/editor/ui/useEditorSaveTriggers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/editor/ui/editorSaveActions.ts \
  src/modules/editor/ui/editorSaveActions.test.ts \
  src/modules/editor/ui/useEditorSaveTriggers.ts
git commit -m "$(cat <<'EOF'
Extract shared editor Save / Save As actions for File menu.

EOF
)"
```

---

### Task 2: Expand native File menu

**Files:**
- Modify: `src/modules/editor/ui/useEditorFileMenu.ts`
- Modify: `src/modules/editor/ui/useEditorFileMenu.test.ts`

**Interfaces:**
- Consumes: `performEditorSave`, `performEditorSaveAs`, `openUntitled`, `openEditorFilesFromPicker`
- Produces: App menu File → New / Open… / Save / Save As… with accelerators from Global Constraints

- [ ] **Step 1: Expand failing menu tests**

Update `useEditorFileMenu.test.ts` to capture all four actions by `id`:

```ts
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
```

In `beforeEach`, clear `actions` (`for (const k of Object.keys(actions)) delete actions[k]`).

Replace / add tests:

```ts
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
  await useEditorStore.getState().openFile("/proj/a.ts");
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
  await useEditorStore.getState().openFile("/proj/a.ts");
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
```

Add imports: `createMemoryEditorApi`, `* as saveAsPromptBridge from "./saveAsPromptBridge"`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/useEditorFileMenu.test.ts`

Expected: FAIL (missing action ids / New-Untitled not opened).

- [ ] **Step 3: Implement full File menu**

Replace menu construction in `useEditorFileMenu.ts` with:

```ts
import { useEffect, useRef } from "react";
import type { EditorFilePicker } from "../infrastructure/editorFilePicker";
import { createTauriEditorFilePicker } from "../infrastructure/editorFilePicker";
import { useEditorStore } from "../state/editorStore";
import { performEditorSave, performEditorSaveAs } from "./editorSaveActions";
import { openEditorFilesFromPicker } from "./openEditorFiles";

export function useEditorFileMenu(picker?: EditorFilePicker) {
  const defaultPickerRef = useRef<EditorFilePicker | null>(null);
  if (!defaultPickerRef.current) {
    defaultPickerRef.current = createTauriEditorFilePicker();
  }
  const resolvedPicker = picker ?? defaultPickerRef.current;

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const { Menu, MenuItem, Submenu } = await import("@tauri-apps/api/menu");
      const newItem = await MenuItem.new({
        id: "editor-new",
        text: "New",
        accelerator: "CmdOrCtrl+N",
        action: () => {
          useEditorStore.getState().openUntitled();
        },
      });
      const openItem = await MenuItem.new({
        id: "editor-open",
        text: "Open…",
        accelerator: "CmdOrCtrl+O",
        action: () => {
          void openEditorFilesFromPicker(resolvedPicker);
        },
      });
      const saveItem = await MenuItem.new({
        id: "editor-save",
        text: "Save",
        accelerator: "CmdOrCtrl+S",
        action: () => {
          performEditorSave();
        },
      });
      const saveAsItem = await MenuItem.new({
        id: "editor-save-as",
        text: "Save As…",
        accelerator: "CmdOrCtrl+Shift+S",
        action: () => {
          performEditorSaveAs();
        },
      });
      const file = await Submenu.new({
        text: "File",
        items: [newItem, openItem, saveItem, saveAsItem],
      });
      const menu = await Menu.new({ items: [file] });
      if (!disposed) {
        await menu.setAsAppMenu();
      }
    })();
    return () => {
      disposed = true;
    };
  }, [resolvedPicker]);
}
```

Note: Do **not** rely on dynamic `enabled` flags that would require rebuilding the menu on every tab change — helpers no-op for RO / no-tab (spec allows this).

- [ ] **Step 4: Run tests — expect PASS**

Run: `bunx vitest run src/modules/editor/ui/useEditorFileMenu.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/useEditorFileMenu.ts \
  src/modules/editor/ui/useEditorFileMenu.test.ts
git commit -m "$(cat <<'EOF'
Add File menu New, Save, and Save As next to Open.

EOF
)"
```

---

### Task 3: Remove strip Open… + copy / CONTEXT

**Files:**
- Modify: `src/modules/editor/ui/EditorTabStrip.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.test.tsx`
- Modify: `src/modules/editor/ui/EditorPanel.tsx`
- Modify: `src/modules/editor/ui/EditorPanel.test.tsx` (only if assertion needs tightening)
- Modify: `src/modules/editor/CONTEXT.md`

**Interfaces:**
- Consumes: none new
- Produces: Strip without Open… / `filePicker`; empty-state copy mentioning File → Open…

- [ ] **Step 1: Update failing strip / panel expectations**

1. Delete the test `Open… button calls openPaths with picked files` from `EditorTabStrip.test.tsx` (and any `filePicker` / `createMemoryEditorFilePicker` imports that become unused).
2. In `EditorPanel.tsx` empty state, change copy to:

```tsx
Open a file from the explorer or File → Open…
```

3. Tighten `EditorPanel.test.tsx` empty-state assertion if present:

```ts
expect(
  screen.getByText(/open a file from the explorer or file → open/i),
).toBeInTheDocument();
```

(The existing loose `/open a file from the explorer/i` matcher still passes — prefer the tighter one.)

- [ ] **Step 2: Run tests — expect FAIL on strip Open… removal (if test still present) or proceed after delete**

Run: `bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx src/modules/editor/ui/EditorPanel.test.tsx`

- [ ] **Step 3: Remove strip Open… UI**

In `EditorTabStrip.tsx`:

- Remove `filePicker` from props/interface/defaults.
- Remove imports of `EditorFilePicker`, `createTauriEditorFilePicker`, `openEditorFilesFromPicker`.
- Delete the Open… `<button>…</button>` block (keep the `+` button).

- [ ] **Step 4: Update CONTEXT.md**

In **Editor Tab**, ensure strip wording does not imply an Open… control (keep `+` and context menu).

In **External / Read-only tab**, change Open… discoverability to File menu:

```md
Absolute path outside `projectRoot`, opened via OS drop or File → Open…; `readOnly` buffer; view-only Monaco; Save/Save As disabled.
```

In **Untitled**, optionally note File → New as well as strip `+` (one short clause).

- [ ] **Step 5: Run focused + editor suite**

```bash
bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx \
  src/modules/editor/ui/EditorPanel.test.tsx \
  src/modules/editor/ui/useEditorFileMenu.test.ts \
  src/modules/editor/ui/editorSaveActions.test.ts
```

Expected: PASS.

Then: `bunx vitest run src/modules/editor` — all tests PASS (pre-existing unhandled `listen` rejections in header tests may still log; do not “fix” those here unless this task introduced them).

- [ ] **Step 6: Commit**

```bash
git add src/modules/editor/ui/EditorTabStrip.tsx \
  src/modules/editor/ui/EditorTabStrip.test.tsx \
  src/modules/editor/ui/EditorPanel.tsx \
  src/modules/editor/ui/EditorPanel.test.tsx \
  src/modules/editor/CONTEXT.md
git commit -m "$(cat <<'EOF'
Remove strip Open…; point empty state at File menu.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| File → New + ⌘N | 2 |
| File → Open… + ⌘O | 2 (existing, kept) |
| File → Save + ⌘S shared with keyboard | 1 + 2 |
| File → Save As… + ⇧⌘S | 1 + 2 |
| RO / no-tab Save no-ops | 1 (+ 2 menu actions) |
| Remove strip Open… | 3 |
| Keep strip `+` / context menus | 3 (no change to those) |
| Empty-state File → Open… | 3 |
| CONTEXT discoverability | 3 |
| No Edit/View menus | 2 (File-only menu) |
