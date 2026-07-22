# Editor Tabs Phase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable tab-strip `+` for Untitled buffers (`untitled:N`), in-app Save As under `projectRoot` (retarget + overwrite confirm), and Desktop `editor_create_file`; path-backed ⌘S/leave/quit-auto-save stay as in 2a.

**Architecture:** Generalize tab identity from absolute paths to `id` (`untitled:N` | abs path). Add `editor_create_file` for create/overwrite under root. UI adds `EditorSaveAsDialog` (folder browser + filename); ⌘S/leave/close/quit route Untitled through Save As. `editor_write_file` remains exist-only for path-tab saves.

**Tech Stack:** React 19, Zustand, Vitest, Testing Library, Tailwind/shadcn, `@base-ui/react/dialog`, Tauri commands, Bun tests, `cargo test` for Desktop.

**Spec:** `docs/specs/2026-07-22-editor-tabs-phase2b-design.md`

## Global Constraints

- Phase **2b only** — no OS drops, no outside-project tabs, no mkdir -p, no native save dialog, no tab persist/reorder.
- Rust-first: no `@tauri-apps/plugin-fs` in `src/modules/*`.
- Tab ids: `untitled:N` or absolute path under `projectRoot`.
- Untitled never calls `writeFile`; Save As always uses `createFile`.
- ⌘S / leave on Untitled → Save As (no silent write). Path tabs unchanged.
- Save As **retargets** the same tab; overwrite requires confirm; if target path already open as another tab, close that other tab after successful create (source wins).
- Quit: auto-save dirty **path** tabs first; then each dirty Untitled → Save As / Don’t save / Cancel; Cancel or failure → prevent quit.
- Empty Untitled starts **clean** until first edit.
- Domain language: shell **main cards** ≠ file **tabs**.
- Package manager / tests: **Bun** — `bun run test`; Desktop — `cargo test` in `src-tauri`.

---

## File structure

| Path | Role |
| ---- | ---- |
| `src-tauri/src/editor/create.rs` | `editor_create_file` |
| `src-tauri/src/editor/error.rs` | Add `ParentNotFound` if needed |
| `src-tauri/src/editor/mod.rs` | Export create |
| `src-tauri/src/lib.rs` | Register command |
| `src/modules/editor/api/editorApi.ts` | `createFile` |
| `src/modules/editor/api/createMemoryEditorApi.ts` | In-memory create/overwrite |
| `src/modules/editor/api/editorApi.test.ts` | API contract tests |
| `src/modules/editor/state/editorTabId.ts` | `isUntitledId`, `tabLabel` |
| `src/modules/editor/state/editorStore.ts` | Ids, Untitled, `saveAs`, path-only quit save |
| `src/modules/editor/state/editorStore.test.ts` | Store coverage |
| `src/modules/editor/ui/EditorTabStrip.tsx` | Enable `+`, labels, Save As control |
| `src/modules/editor/ui/EditorSaveAsDialog.tsx` | Folder + filename + overwrite |
| `src/modules/editor/ui/EditorSaveAsDialog.test.tsx` | Dialog behavior |
| `src/modules/editor/ui/EditorCloseTabDialog.tsx` | Untitled Save → Save As |
| `src/modules/editor/ui/EditorCardHeader.tsx` | Orchestrate close + Save As + quit prompts |
| `src/modules/editor/ui/useEditorSaveTriggers.ts` | Untitled leave/⌘S; quit path-then-Untitled |
| `src/modules/editor/ui/saveAsPromptBridge.ts` | Awaitable UI prompt for quit loop |
| `src/modules/editor/CONTEXT.md` | Untitled / Save As terms |
| Other editor UI (`EditorPanel`, `MonacoEditorHost`, tests) | Rename `path`/`activePath` → `id`/`activeTabId` |

---

### Task 1: Desktop `editor_create_file`

**Files:**
- Create: `src-tauri/src/editor/create.rs`
- Modify: `src-tauri/src/editor/error.rs`
- Modify: `src-tauri/src/editor/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/docs/adr/0001-rust-first-desktop-boundary.md` (list new command)

**Interfaces:**
- Consumes: `ensure_under_root`, `EditorError`
- Produces: `editor_create_file(EditorCreateInput { project_root, path, content }) -> Result<(), EditorError>`

- [ ] **Step 1: Add `ParentNotFound` and failing/create tests**

In `error.rs`, add:

```rust
ParentNotFound(String),
```

Create `create.rs` with tests first (same style as `write.rs`):

```rust
use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use crate::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorCreateInput {
    pub project_root: String,
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub fn editor_create_file(input: EditorCreateInput) -> Result<(), EditorError> {
    let path = ensure_under_root(Path::new(&input.project_root), Path::new(&input.path))
        .map_err(|_| EditorError::OutsideProject(input.path.clone()))?;

    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(EditorError::ParentNotFound(input.path));
        }
    }

    if path.exists() {
        if !path.is_file() {
            return Err(EditorError::NotAFile(input.path));
        }
    }

    fs::write(&path, input.content.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn creates_missing_file_when_parent_exists() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("new.txt");
        editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
            content: "hi".into(),
        })
        .unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "hi");
    }

    #[test]
    fn overwrites_existing_file() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("a.txt");
        fs::write(&file, "old").unwrap();
        editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
            content: "new".into(),
        })
        .unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new");
    }

    #[test]
    fn rejects_missing_parent() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("nope").join("a.txt");
        let result = editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: file.to_string_lossy().into_owned(),
            content: "x".into(),
        });
        assert!(matches!(result, Err(EditorError::ParentNotFound(_))));
    }

    #[test]
    fn rejects_outside_project() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("opencore-editor-create-outside.txt");
        let result = editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: outside.to_string_lossy().into_owned(),
            content: "x".into(),
        });
        assert!(matches!(result, Err(EditorError::OutsideProject(_))));
    }

    #[test]
    fn rejects_directory_target() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        let result = editor_create_file(EditorCreateInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: sub.to_string_lossy().into_owned(),
            content: "x".into(),
        });
        assert!(matches!(result, Err(EditorError::NotAFile(_))));
    }
}
```

- [ ] **Step 2: Run Desktop tests — expect FAIL until wired**

Run: `cd src-tauri && cargo test editor::create -- --nocapture`  
Expected: compile/link errors until mod + lib registration, then tests PASS once implemented.

- [ ] **Step 3: Register module and command**

`mod.rs`:

```rust
mod create;
pub use create::editor_create_file;
```

`lib.rs` invoke handler: add `editor::create::editor_create_file`.

Confirm `editor_write_file` still rejects missing files (unchanged).

- [ ] **Step 4: Re-run tests**

Run: `cd src-tauri && cargo test editor:: -- --nocapture`  
Expected: PASS (create + existing read/write).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/editor/create.rs src-tauri/src/editor/error.rs src-tauri/src/editor/mod.rs src-tauri/src/lib.rs src-tauri/docs/adr/0001-rust-first-desktop-boundary.md
git commit -m "Add editor_create_file Desktop command for Save As."
```

---

### Task 2: `EditorApi.createFile`

**Files:**
- Modify: `src/modules/editor/api/editorApi.ts`
- Modify: `src/modules/editor/api/createMemoryEditorApi.ts`
- Modify: `src/modules/editor/api/editorApi.test.ts`

**Interfaces:**
- Consumes: Tauri `editor_create_file`
- Produces:

```ts
export interface EditorApi {
  readFile(projectRoot: string, path: string): Promise<string>;
  writeFile(projectRoot: string, path: string, content: string): Promise<void>;
  createFile(projectRoot: string, path: string, content: string): Promise<void>;
}
```

- [ ] **Step 1: Write failing API tests**

Extend `editorApi.test.ts` (or add cases) so memory API:

```ts
it("createFile creates missing paths and overwrites existing", async () => {
  const api = createMemoryEditorApi({ files: { "/proj/a.txt": "old" } });
  await api.createFile("/proj", "/proj/b.txt", "new");
  expect(await api.readFile("/proj", "/proj/b.txt")).toBe("new");
  await api.createFile("/proj", "/proj/a.txt", "replaced");
  expect(await api.readFile("/proj", "/proj/a.txt")).toBe("replaced");
});

it("writeFile still rejects missing files", async () => {
  const api = createMemoryEditorApi();
  await expect(api.writeFile("/proj", "/proj/missing.txt", "x")).rejects.toThrow(/not found/i);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/editor/api/editorApi.test.ts`  
Expected: FAIL — `createFile` missing.

- [ ] **Step 3: Implement**

`editorApi.ts`:

```ts
createFile: (projectRoot, path, content) =>
  invoke("editor_create_file", { input: { projectRoot, path, content } }),
```

`createMemoryEditorApi.ts`:

```ts
createFile: async (_projectRoot, path, content) => {
  files.set(path, content);
},
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bunx vitest run src/modules/editor/api/editorApi.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/api/editorApi.ts src/modules/editor/api/createMemoryEditorApi.ts src/modules/editor/api/editorApi.test.ts
git commit -m "Add EditorApi.createFile for Untitled Save As."
```

---

### Task 3: Store — tab ids, Untitled, `saveAs`

**Files:**
- Create: `src/modules/editor/state/editorTabId.ts`
- Create: `src/modules/editor/state/editorTabId.test.ts`
- Modify: `src/modules/editor/state/editorStore.ts`
- Modify: `src/modules/editor/state/editorStore.test.ts`
- Modify: all editor UI/tests that use `activePath` / `tab.path` / `saveTab(path)` (mechanical rename in this task so the suite compiles)

**Interfaces:**
- Consumes: `EditorApi.createFile` / `writeFile`
- Produces:

```ts
// editorTabId.ts
export function isUntitledId(id: string): boolean;
export function tabLabel(id: string): string; // Untitled-N or basename

export interface EditorTab {
  id: string;
}

export interface EditorState {
  api: EditorApi | null;
  projectRoot: string | null;
  tabs: EditorTab[];
  activeTabId: string | null;
  buffers: Record<string, EditorBuffer>;
  nextUntitled: number;
  bindApi: (api: EditorApi) => void;
  setContentFromEditor: (content: string) => void;
  clearSaveError: (id?: string) => void;
  saveIfDirty: () => Promise<boolean>; // path only; Untitled dirty → return false without write (UI opens Save As)
  save: () => Promise<boolean>; // path only; Untitled → return false without write
  saveTab: (id: string) => Promise<boolean>; // no-op false for Untitled
  /** Path-backed dirty tabs only (quit step 1). */
  saveAllDirtyPaths: () => Promise<boolean>;
  openFile: (projectRoot: string, path: string) => Promise<boolean>;
  openUntitled: () => string; // returns new id
  setActiveTabId: (id: string) => void;
  closeTab: (id: string) => void;
  /**
   * createFile then retarget. If targetId already open as another tab, close it after successful create.
   * Returns false on failure (sets saveError on source).
   */
  saveAs: (sourceId: string, targetPath: string) => Promise<boolean>;
  dirtyUntitledIds: () => string[];
}
```

**`save` / `saveIfDirty` contract for Untitled:** return `false` immediately without Desktop I/O when active id is Untitled (and dirty for `saveIfDirty`). UI treats `false` + `isUntitledId` as “open Save As”. Path behavior unchanged (`true` when clean for `saveIfDirty`).

Remove old `saveAllDirty` or make it an alias that **only** saves paths (same as `saveAllDirtyPaths`) — do **not** attempt Untitled writes. Prefer rename to `saveAllDirtyPaths` and update quit call sites in Task 5.

- [ ] **Step 1: Helpers + failing store tests**

`editorTabId.ts`:

```ts
const UNTITLED_RE = /^untitled:(\d+)$/;

export function isUntitledId(id: string): boolean {
  return UNTITLED_RE.test(id);
}

export function tabLabel(id: string): string {
  const m = UNTITLED_RE.exec(id);
  if (m) return `Untitled-${m[1]}`;
  return id.split(/[/\\]/).pop() ?? id;
}
```

Add store tests (adapt existing helpers to `id` / `activeTabId`):

```ts
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
```

- [ ] **Step 2: Run store tests — expect FAIL**

Run: `bunx vitest run src/modules/editor/state/editorStore.test.ts src/modules/editor/state/editorTabId.test.ts`  
Expected: FAIL on new APIs / rename.

- [ ] **Step 3: Implement store + mechanical renames**

Core `openUntitled` / `saveAs` sketch:

```ts
openUntitled: () => {
  const n = get().nextUntitled;
  const id = `untitled:${n}`;
  const { tabs, buffers } = get();
  set({
    nextUntitled: n + 1,
    tabs: [...tabs, { id }],
    activeTabId: id,
    buffers: {
      ...buffers,
      [id]: {
        content: "",
        baselineContent: "",
        dirty: false,
        status: "ready",
        errorMessage: null,
        saveError: null,
      },
    },
  });
  return id;
},

saveAs: async (sourceId, targetPath) => {
  const { api, projectRoot, buffers, tabs, activeTabId } = get();
  const buffer = buffers[sourceId];
  if (!api || !projectRoot || !buffer) return false;
  set({
    buffers: patchBuffer(buffers, sourceId, { status: "saving", saveError: null }),
  });
  try {
    await api.createFile(projectRoot, targetPath, buffer.content);
  } catch (error) {
    set((s) => ({
      buffers: patchBuffer(s.buffers, sourceId, {
        status: "ready",
        saveError: toErrorMessage(error),
      }),
    }));
    return false;
  }

  // Close colliding tab (not source)
  const collision = get().tabs.find((t) => t.id === targetPath && t.id !== sourceId);
  if (collision) {
    get().closeTab(targetPath);
  }

  const state = get();
  const buf = state.buffers[sourceId];
  if (!buf) return false;
  const { [sourceId]: _removed, ...rest } = state.buffers;
  const nextTabs = state.tabs.map((t) =>
    t.id === sourceId ? { id: targetPath } : t,
  );
  // Dedupe if map produced duplicates (should not after close)
  const deduped: EditorTab[] = [];
  for (const t of nextTabs) {
    if (!deduped.some((x) => x.id === t.id)) deduped.push(t);
  }
  set({
    tabs: deduped,
    activeTabId: state.activeTabId === sourceId ? targetPath : state.activeTabId,
    buffers: {
      ...rest,
      [targetPath]: {
        ...buf,
        baselineContent: buf.content,
        dirty: false,
        status: "ready",
        saveError: null,
      },
    },
  });
  return true;
},
```

`saveTab`: if `isUntitledId(id)` return `false` without I/O.  
`saveAllDirtyPaths`: only tabs where `!isUntitledId(tab.id) && buffers[id].dirty`.  
Rename fields everywhere in `src/modules/editor/**`.

- [ ] **Step 4: Run editor module tests**

Run: `bunx vitest run src/modules/editor`  
Expected: PASS (update any stale test helpers).

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor
git commit -m "Refactor editorStore for Untitled ids and saveAs."
```

---

### Task 4: Tab strip — enable `+`, labels, Save As entry

**Files:**
- Modify: `src/modules/editor/ui/EditorTabStrip.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.test.tsx`
- Modify: `src/modules/editor/ui/EditorCardHeader.tsx` (pass `onRequestSaveAs`)
- Modify: `src/modules/editor/CONTEXT.md`

**Interfaces:**
- Consumes: `openUntitled`, `tabLabel`, `setActiveTabId`
- Produces: enabled `+`; optional “Save As…” button calling `onRequestSaveAs()` for active tab

- [ ] **Step 1: Failing strip tests**

```ts
it("enables + and opens an untitled tab", async () => {
  const user = userEvent.setup();
  useEditorStore.getState().bindApi(createMemoryEditorApi());
  useEditorStore.setState({ projectRoot: "/proj" });
  render(<EditorTabStrip onRequestCloseTab={() => {}} onRequestSaveAs={() => {}} />);
  const add = screen.getByRole("button", { name: /new untitled file/i });
  expect(add).toBeEnabled();
  await user.click(add);
  expect(useEditorStore.getState().tabs[0]?.id).toBe("untitled:1");
  expect(screen.getByRole("tab", { name: /untitled-1/i })).toBeTruthy();
});
```

Remove expectations that `+` is disabled / “come later”.

- [ ] **Step 2: Run — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx`  
Expected: FAIL (still disabled).

- [ ] **Step 3: Implement strip**

- Use `tabLabel(tab.id)` for display and aria.
- `+` enabled → `openUntitled()`; require `projectRoot` (if null, no-op or keep disabled — **if null, leave disabled**).
- Add button `aria-label="Save As…"` enabled when `activeTabId` set → `onRequestSaveAs()`.
- Title on `+`: remove “come later”.

- [ ] **Step 4: Run — expect PASS**

Run: `bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/EditorTabStrip.tsx src/modules/editor/ui/EditorTabStrip.test.tsx src/modules/editor/ui/EditorCardHeader.tsx src/modules/editor/CONTEXT.md
git commit -m "Enable editor + for Untitled and Save As entry."
```

---

### Task 5: `EditorSaveAsDialog` + close/leave/⌘S/quit wiring

**Files:**
- Create: `src/modules/editor/ui/EditorSaveAsDialog.tsx`
- Create: `src/modules/editor/ui/EditorSaveAsDialog.test.tsx`
- Create: `src/modules/editor/ui/saveAsPromptBridge.ts`
- Modify: `src/modules/editor/ui/EditorCloseTabDialog.tsx` (+ tests)
- Modify: `src/modules/editor/ui/EditorCardHeader.tsx`
- Modify: `src/modules/editor/ui/useEditorSaveTriggers.ts` (+ tests)
- Modify: `src-tauri/docs/adr/0001-rust-first-desktop-boundary.md` if not done in Task 1

**Interfaces:**
- Consumes: `saveAs`, `isUntitledId`, `tabLabel`, explorer `listDir` for folder browser
- Produces: dialog + bridge for awaitable quit prompts

**Save As dialog UX (concrete):**
- Props: `sourceId: string | null`, `onOpenChange`, optional `listSubdirs(projectRoot, dir) => Promise<string[]>` (default: Tauri explorer `listDir` filtered to directories; tests inject memory).
- State: `directory` (abs path, default `projectRoot` or `dirname(sourceId)` when path-backed), `filename` (default empty or basename for path Save As).
- UI: show project-relative directory; **Up** (clamp at root); list subfolders as buttons; filename input; Save / Cancel.
- Empty filename → show validation, no `saveAs` call.
- If `api`/memory indicates target exists **or** `listDir` shows file with that name → show overwrite confirm step before `saveAs`.
- On success: `onOpenChange(false)`; on failure: keep open (store sets `saveError`).

**Close dialog:** if `isUntitledId(path)` (now id), **Save** does not call `saveTab`; instead call `onRequestSaveAsForClose(id)` so header opens Save As and closes tab only after successful `saveAs`.

**Bridge (`saveAsPromptBridge.ts`):**

```ts
type QuitUntitledResult = "saved" | "discarded" | "cancelled" | "failed";

let quitHandler:
  | ((id: string) => Promise<QuitUntitledResult>)
  | null = null;

export function registerQuitUntitledHandler(
  handler: ((id: string) => Promise<QuitUntitledResult>) | null,
): void {
  quitHandler = handler;
}

export async function promptQuitUntitled(id: string): Promise<QuitUntitledResult> {
  if (!quitHandler) return "cancelled";
  return quitHandler(id);
}
```

Header registers handler that opens a Save As / Don’t save / Cancel flow for that id and resolves the promise.

**`useEditorSaveTriggers`:**
- Leave: if active Untitled dirty → do not write; call a registered `onRequestSaveAs(activeTabId)` (same bridge or `registerLeaveSaveAsHandler`); still allow card switch.
- ⌘S: if Untitled → `preventDefault` + request Save As; else `save()`.
- Quit:

```ts
const ok = await useEditorStore.getState().saveAllDirtyPaths();
if (!ok) {
  useShellStore.getState().setActiveMainCard("editor");
  event.preventDefault();
  return;
}
for (const id of useEditorStore.getState().dirtyUntitledIds()) {
  useShellStore.getState().setActiveMainCard("editor");
  const result = await promptQuitUntitled(id);
  if (result === "cancelled" || result === "failed") {
    event.preventDefault();
    return;
  }
  // saved → saveAs already retargeted; discarded → closeTab already
}
```

- [ ] **Step 1: Failing dialog + trigger tests**

Dialog: validates empty name; Save calls `saveAs`; overwrite confirm appears when file exists; failure keeps dialog.

Triggers: ⌘S on Untitled requests Save As (spy bridge); leave on Untitled does not call `writeFile`/`createFile`; quit saves path then prompts Untitled.

Close: Untitled Save opens Save As path (spy), does not call `writeFile`.

- [ ] **Step 2: Run — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/EditorSaveAsDialog.test.tsx src/modules/editor/ui/useEditorSaveTriggers.test.tsx src/modules/editor/ui/EditorCloseTabDialog.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement dialog, bridge, header orchestration, triggers**

Keep dialog styling consistent with `EditorCloseTabDialog` (Base UI Dialog).

Overwrite step: secondary confirm in same popup (“Replace existing file?” Replace / Cancel) before `saveAs`.

- [ ] **Step 4: Full editor + related tests**

Run: `bun run test`  
Expected: PASS (271+ tests; new cases green).

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor
git commit -m "Wire Save As dialog into close, leave, shortcut, and quit."
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| `editor_create_file` create/overwrite/parent/outside/dir | 1 |
| `EditorApi.createFile` | 2 |
| `untitled:N`, `openUntitled`, clean until edit | 3 |
| `saveAs` retarget + collision close | 3 |
| Path save still `writeFile`; Untitled skips write | 3 |
| `saveAllDirtyPaths` | 3 |
| Enable `+`, labels, Save As entry | 4 |
| In-app folder + filename Save As | 5 |
| Overwrite confirm | 5 |
| ⌘S/leave Untitled → Save As | 5 |
| Dirty close Untitled → Save As | 5 |
| Quit path then Untitled prompts | 5 |
| No mkdir, no 2c | constraints |

---

## Self-review notes

- No TBD placeholders; signatures use `activeTabId` / `id` consistently after Task 3.
- `save` returning `false` for Untitled is the UI signal — document in store JSDoc so Task 5 does not call Desktop.
- Folder listing uses explorer `listDir` via injectable callback to stay Rust-first and testable.
