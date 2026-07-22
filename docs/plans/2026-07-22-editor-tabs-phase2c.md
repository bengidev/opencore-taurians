# Editor Tabs Phase 2c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open OS-dropped and File→Open… paths into the Editor: under-`projectRoot` as writable tabs; outside as view-only tabs (Monaco read-only, Save/Save As disabled, lock/RO badge).

**Architecture:** Classify-on-open via `openPaths(paths[])`. Desktop adds `editor_read_external_file` plus path probes (`is_under_root`, directory preflight). Reuse existing window `DragDrop` → `explorer://drop` (and drag hover emits) with hit-testing so drops over the Editor strip open tabs instead of explorer copy. Open… uses the dialog plugin (same pattern as folder picker) from an Editor control and a native File menu item.

**Tech Stack:** React 19, Zustand, Vitest, Testing Library, Tauri 2 commands + window + window-dialog, Bun tests, `cargo test` for Desktop.

**Spec:** `docs/specs/2026-07-22-editor-tabs-phase2c-design.md`

## Global Constraints

- Phase **2c only** — no Save As from RO tabs into project; no recursive folder open; no tab persist/reorder; no native save dialog; no editing/saving outside-project files on disk.
- Rust-first: no `@tauri-apps/plugin-fs` in `src/modules/*`. Dialog may use thin infrastructure (like folder picker).
- `projectRoot` required for Open… / OS drop / `openPaths`; without it → brief error, open nothing.
- Multi-file: open all. If **any** path is an **existing directory** → reject whole batch; open none; error copy: `Folders can't be opened here`.
- Outside → `readOnly: true`; Monaco `readOnly`; Save / Save As / ⌘S no-ops; never `writeFile` / `createFile`.
- Under-root classification must match Desktop `ensure_under_root` (via `editor_is_under_root` command — do not invent looser string-prefix rules in production).
- Explorer MIME drop unchanged (`openFile`).
- OS drop over Editor strip → `openPaths`; over Explorer → existing copy behavior.
- Package manager / tests: **Bun** — `bunx vitest run …` / `bun run test`. Desktop — `cargo test` in `src-tauri`.
- Domain language: shell **main cards** ≠ file **tabs**.

---

## File structure

| Path | Role |
| ---- | ---- |
| `src-tauri/src/editor/read_external.rs` | `editor_read_external_file` |
| `src-tauri/src/editor/path_query.rs` | `editor_is_under_root`, `editor_paths_include_directory` |
| `src-tauri/src/editor/mod.rs` | Export new modules/commands |
| `src-tauri/src/lib.rs` | Register commands; emit drag enter/over/leave for highlight |
| `src-tauri/docs/adr/0001-rust-first-desktop-boundary.md` | List new commands |
| `src/modules/editor/api/editorApi.ts` | `readExternalFile`, `isUnderRoot`, `pathsIncludeDirectory` |
| `src/modules/editor/api/createMemoryEditorApi.ts` | Memory doubles + optional `directories` seed |
| `src/modules/editor/api/editorApi.test.ts` | API contract tests |
| `src/modules/editor/state/editorStore.ts` | `readOnly` on buffers; `openPaths`; save/edit guards; `openBatchError` |
| `src/modules/editor/state/editorStore.test.ts` | Classify / RO / directory abort |
| `src/modules/editor/ui/MonacoEditorHost.tsx` | `options.readOnly` from buffer |
| `src/modules/editor/ui/EditorTabStrip.tsx` | RO badge; disable Save/Save As; `data-editor-drop-zone`; Open control |
| `src/modules/editor/ui/EditorTabStrip.test.tsx` | Badge + disabled menu items |
| `src/modules/editor/ui/EditorPanel.tsx` | Show `openBatchError`; empty-state Open |
| `src/modules/editor/ui/useEditorOsFileDrop.ts` | Listen OS drag/drop; hit-test strip; call `openPaths` |
| `src/modules/editor/infrastructure/editorFilePicker.ts` | Multi-file Open dialog |
| `src/modules/editor/ui/useEditorFileMenu.ts` | Native File → Open… → picker → `openPaths` |
| `src/modules/explorer/ui/ExplorerPanel.tsx` | Skip copy when drop hits `[data-editor-drop-zone]` |
| `src/modules/editor/CONTEXT.md` | External / read-only terms |

---

### Task 1: Desktop external read + path queries

**Files:**
- Create: `src-tauri/src/editor/read_external.rs`
- Create: `src-tauri/src/editor/path_query.rs`
- Modify: `src-tauri/src/editor/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/docs/adr/0001-rust-first-desktop-boundary.md`

**Interfaces:**
- Consumes: `EditorError`, `MAX_EDITOR_FILE_BYTES` from `read.rs` (re-export or move constant to a shared place — prefer `use super::read::MAX_EDITOR_FILE_BYTES` if pub, else duplicate the same `2 * 1024 * 1024` value and comment “keep in sync”), `ensure_under_root`
- Produces:
  - `editor_read_external_file(EditorExternalReadInput { path: String }) -> Result<String, EditorError>`
  - `editor_is_under_root(EditorUnderRootInput { project_root, path }) -> Result<bool, EditorError>` (Io only on freak failures; normal outside → `Ok(false)`)
  - `editor_paths_include_directory(EditorPathsInput { paths: Vec<String> }) -> Result<bool, EditorError>` — `true` if **any** path `exists()` and `is_dir()`

- [ ] **Step 1: Make `MAX_EDITOR_FILE_BYTES` usable from sibling modules**

In `src-tauri/src/editor/read.rs`, ensure:

```rust
pub const MAX_EDITOR_FILE_BYTES: u64 = 2 * 1024 * 1024;
```

(already `pub` — confirm; if private, change to `pub`.)

- [ ] **Step 2: Write failing tests for `editor_read_external_file`**

Create `read_external.rs` with tests **first** (command body can `todo!()` temporarily, or write tests that won't compile until the fn exists — prefer full file with tests calling the fn):

```rust
use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use super::read::MAX_EDITOR_FILE_BYTES;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorExternalReadInput {
    pub path: String,
}

#[tauri::command]
pub fn editor_read_external_file(input: EditorExternalReadInput) -> Result<String, EditorError> {
    let path = Path::new(&input.path);

    if !path.exists() {
        return Err(EditorError::NotFound(input.path));
    }
    if !path.is_file() {
        return Err(EditorError::NotAFile(input.path));
    }

    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_EDITOR_FILE_BYTES {
        return Err(EditorError::TooLarge(input.path));
    }

    let bytes = fs::read(path)?;
    if bytes.contains(&0) {
        return Err(EditorError::BinaryOrNonUtf8(input.path));
    }
    String::from_utf8(bytes).map_err(|_| EditorError::BinaryOrNonUtf8(input.path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn reads_file_outside_any_project() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("outside.txt");
        fs::write(&file, "hello-ext").unwrap();
        let content = editor_read_external_file(EditorExternalReadInput {
            path: file.to_string_lossy().into_owned(),
        })
        .unwrap();
        assert_eq!(content, "hello-ext");
    }

    #[test]
    fn rejects_directory() {
        let dir = tempdir().unwrap();
        let result = editor_read_external_file(EditorExternalReadInput {
            path: dir.path().to_string_lossy().into_owned(),
        });
        assert!(matches!(result, Err(EditorError::NotAFile(_))));
    }

    #[test]
    fn rejects_missing() {
        let result = editor_read_external_file(EditorExternalReadInput {
            path: "/tmp/opencore-missing-external-read-xyz.txt".into(),
        });
        assert!(matches!(result, Err(EditorError::NotFound(_))));
    }
}
```

- [ ] **Step 3: Write `path_query.rs` with tests**

```rust
use std::path::Path;

use serde::Deserialize;

use super::error::EditorError;
use crate::path_scope::ensure_under_root;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorUnderRootInput {
    pub project_root: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorPathsInput {
    pub paths: Vec<String>,
}

#[tauri::command]
pub fn editor_is_under_root(input: EditorUnderRootInput) -> Result<bool, EditorError> {
    Ok(ensure_under_root(Path::new(&input.project_root), Path::new(&input.path)).is_ok())
}

#[tauri::command]
pub fn editor_paths_include_directory(input: EditorPathsInput) -> Result<bool, EditorError> {
    for path in &input.paths {
        let p = Path::new(path);
        if p.exists() && p.is_dir() {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn under_root_true_for_child() {
        let dir = tempdir().unwrap();
        let child = dir.path().join("a.txt");
        fs::write(&child, "x").unwrap();
        assert!(editor_is_under_root(EditorUnderRootInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: child.to_string_lossy().into_owned(),
        })
        .unwrap());
    }

    #[test]
    fn under_root_false_for_outside() {
        let dir = tempdir().unwrap();
        let outside = std::env::temp_dir().join("opencore-under-root-outside.txt");
        let _ = fs::write(&outside, "x");
        assert!(!editor_is_under_root(EditorUnderRootInput {
            project_root: dir.path().to_string_lossy().into_owned(),
            path: outside.to_string_lossy().into_owned(),
        })
        .unwrap());
    }

    #[test]
    fn paths_include_directory_detects_dir() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("f.txt");
        fs::write(&file, "x").unwrap();
        assert!(editor_paths_include_directory(EditorPathsInput {
            paths: vec![
                file.to_string_lossy().into_owned(),
                dir.path().to_string_lossy().into_owned(),
            ],
        })
        .unwrap());
    }

    #[test]
    fn paths_include_directory_false_for_files_only() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("f.txt");
        fs::write(&file, "x").unwrap();
        assert!(!editor_paths_include_directory(EditorPathsInput {
            paths: vec![file.to_string_lossy().into_owned()],
        })
        .unwrap());
    }
}
```

- [ ] **Step 4: Export + register**

`mod.rs`:

```rust
pub mod create;
mod error;
pub mod path_query;
pub mod read;
pub mod read_external;
pub mod write;

pub use create::editor_create_file;
pub use path_query::{editor_is_under_root, editor_paths_include_directory};
pub use read::editor_read_file;
pub use read_external::editor_read_external_file;
pub use write::editor_write_file;
```

Register all three new commands in `lib.rs` `invoke_handler`.

Update ADR examples table to mention `editor_read_external_file` / path probes.

- [ ] **Step 5: Run Desktop tests**

Run: `cd src-tauri && cargo test editor::`

Expected: PASS (new modules + existing editor tests)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/editor/read_external.rs src-tauri/src/editor/path_query.rs \
  src-tauri/src/editor/mod.rs src-tauri/src/editor/read.rs src-tauri/src/lib.rs \
  src-tauri/docs/adr/0001-rust-first-desktop-boundary.md
git commit -m "$(cat <<'EOF'
Add editor external read and path probe Desktop commands.

EOF
)"
```

---

### Task 2: EditorApi + memory doubles

**Files:**
- Modify: `src/modules/editor/api/editorApi.ts`
- Modify: `src/modules/editor/api/createMemoryEditorApi.ts`
- Modify: `src/modules/editor/api/editorApi.test.ts`

**Interfaces:**
- Consumes: Task 1 command names
- Produces:

```ts
export interface EditorApi {
  readFile(projectRoot: string, path: string): Promise<string>;
  writeFile(projectRoot: string, path: string, content: string): Promise<void>;
  createFile(projectRoot: string, path: string, content: string): Promise<void>;
  readExternalFile(path: string): Promise<string>;
  isUnderRoot(projectRoot: string, path: string): Promise<boolean>;
  pathsIncludeDirectory(paths: string[]): Promise<boolean>;
}
```

- [ ] **Step 1: Failing tests**

Extend `editorApi.test.ts`:

```ts
it("readExternalFile returns seeded outside path", async () => {
  const api = createMemoryEditorApi({
    files: { "/tmp/out.txt": "ext" },
  });
  await expect(api.readExternalFile("/tmp/out.txt")).resolves.toBe("ext");
});

it("isUnderRoot uses projectRoot prefix semantics in memory", async () => {
  const api = createMemoryEditorApi();
  await expect(api.isUnderRoot("/proj", "/proj/a.ts")).resolves.toBe(true);
  await expect(api.isUnderRoot("/proj", "/other/a.ts")).resolves.toBe(false);
});

it("pathsIncludeDirectory respects directories seed", async () => {
  const api = createMemoryEditorApi({
    directories: ["/tmp/folder"],
  });
  await expect(api.pathsIncludeDirectory(["/tmp/folder", "/tmp/a.txt"])).resolves.toBe(
    true,
  );
  await expect(api.pathsIncludeDirectory(["/tmp/a.txt"])).resolves.toBe(false);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/editor/api/editorApi.test.ts`

Expected: FAIL (missing methods)

- [ ] **Step 3: Implement API**

```ts
// editorApi.ts — add to interface + createTauriEditorApi:
readExternalFile: (path) =>
  invoke("editor_read_external_file", { input: { path } }),
isUnderRoot: (projectRoot, path) =>
  invoke("editor_is_under_root", { input: { projectRoot, path } }),
pathsIncludeDirectory: (paths) =>
  invoke("editor_paths_include_directory", { input: { paths } }),
```

Memory API:

```ts
export interface MemoryEditorSeed {
  files?: Record<string, string>;
  directories?: string[];
}

export function createMemoryEditorApi(seed: MemoryEditorSeed = {}) {
  const files = new Map<string, string>(Object.entries(seed.files ?? {}));
  const directories = new Set(seed.directories ?? []);

  // ...existing assertExists / readFile / writeFile / createFile...

  return {
    files,
    directories,
    // ...existing methods...
    readExternalFile: async (path: string) => {
      assertExists(path);
      return files.get(path)!;
    },
    isUnderRoot: async (projectRoot: string, path: string) => {
      const root = projectRoot.endsWith("/") ? projectRoot.slice(0, -1) : projectRoot;
      return path === root || path.startsWith(`${root}/`);
    },
    pathsIncludeDirectory: async (paths: string[]) =>
      paths.some((p) => directories.has(p)),
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bunx vitest run src/modules/editor/api/editorApi.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/api/editorApi.ts \
  src/modules/editor/api/createMemoryEditorApi.ts \
  src/modules/editor/api/editorApi.test.ts
git commit -m "$(cat <<'EOF'
Extend EditorApi with external read and path probes.

EOF
)"
```

---

### Task 3: Store `readOnly` + `openPaths`

**Files:**
- Modify: `src/modules/editor/state/editorStore.ts`
- Modify: `src/modules/editor/state/editorStore.test.ts`

**Interfaces:**
- Consumes: `EditorApi.readExternalFile`, `isUnderRoot`, `pathsIncludeDirectory`
- Produces:
  - `EditorBuffer.readOnly: boolean`
  - `openBatchError: string | null` on state
  - `clearOpenBatchError: () => void`
  - `openPaths: (paths: string[]) => Promise<boolean>` — `true` if batch not aborted; individual load failures still return `true` after attempting opens
  - `openFile` sets `readOnly: false` on project loads
  - `openUntitled` sets `readOnly: false`
  - `setContentFromEditor` no-ops when active buffer `readOnly`
  - `save` / `saveIfDirty` / `saveTab` return `false` immediately for `readOnly` (no write)

**Folder error copy (exact):** `Folders can't be opened here`

**No-project error copy (exact):** `Open a project first`

- [ ] **Step 1: Write failing store tests**

Add to `editorStore.test.ts` (use memory API with outside + project files):

```ts
const PROJECT_ROOT = "/proj";
const FILE_A = "/proj/a.ts";
const OUTSIDE = "/tmp/outside.ts";

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

it("setContentFromEditor no-ops for readOnly active tab", async () => {
  const api = createMemoryEditorApi({ files: { [OUTSIDE]: "out" } });
  useEditorStore.getState().bindApi(api);
  useEditorStore.setState({ projectRoot: PROJECT_ROOT });
  await useEditorStore.getState().openPaths([OUTSIDE]);
  useEditorStore.getState().setContentFromEditor("hacked");
  expect(useEditorStore.getState().buffers[OUTSIDE]?.content).toBe("out");
  expect(useEditorStore.getState().buffers[OUTSIDE]?.dirty).toBe(false);
});
```

Also update any `emptyBuffer()` / Untitled expectations so `readOnly: false` is present (fix existing tests if they assert full buffer shapes).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/editor/state/editorStore.test.ts`

- [ ] **Step 3: Implement store changes**

Conceptual implementation:

```ts
export interface EditorBuffer {
  // ...existing...
  readOnly: boolean;
}

function emptyBuffer(): EditorBuffer {
  return {
    content: "",
    baselineContent: "",
    dirty: false,
    status: "idle",
    errorMessage: null,
    saveError: null,
    readOnly: false,
  };
}

// state fields:
openBatchError: string | null;

clearOpenBatchError: () => set({ openBatchError: null }),

setContentFromEditor: (content) => {
  const { activeTabId, buffers } = get();
  if (!activeTabId) return;
  const buffer = buffers[activeTabId];
  if (!buffer || buffer.readOnly) return;
  // ...existing dirty patch...
},

// in saveTab / save / saveIfDirty — after resolving buffer:
if (buffer.readOnly || isUntitledId(id)) {
  // Untitled keeps existing Untitled behavior; readOnly:
  if (buffer.readOnly) return false;
}

openPaths: async (paths) => {
  const { api, projectRoot } = get();
  if (!projectRoot) {
    set({ openBatchError: "Open a project first" });
    return false;
  }
  if (!api) {
    set({ openBatchError: "Editor API not bound" });
    return false;
  }
  if (paths.length === 0) {
    return true;
  }

  const hasDir = await api.pathsIncludeDirectory(paths);
  if (hasDir) {
    set({ openBatchError: "Folders can't be opened here" });
    return false;
  }

  set({ openBatchError: null });

  let lastId: string | null = null;
  for (const path of paths) {
    const under = await api.isUnderRoot(projectRoot, path);
    if (under) {
      await get().openFile(projectRoot, path);
      // ensure readOnly false after openFile
      set((s) => ({
        buffers: patchBuffer(s.buffers, path, { readOnly: false }),
      }));
    } else {
      await get().openExternalReadOnly(path);
    }
    lastId = path;
  }
  if (lastId) {
    set({ activeTabId: lastId });
  }
  return true;
},
```

Add private-style helper on the store (same object):

```ts
openExternalReadOnly: async (path: string) => {
  // Mirror openFile structure but:
  // - readOnly: true
  // - api.readExternalFile(path)
  // - do not require path under root
},
```

Prefer implementing `openExternalReadOnly` as an internal function used only by `openPaths` (can still be on the store interface if tests need it — otherwise keep unexported closure inside `openPaths`). **Do export on the store** as `openExternalReadOnly` only if a test needs it; otherwise keep logic inside `openPaths` / shared local async function in the file.

Ensure `openFile` always patches `readOnly: false` when creating/loading project buffers.

- [ ] **Step 4: Run store tests — expect PASS**

Run: `bunx vitest run src/modules/editor/state/editorStore.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/state/editorStore.ts src/modules/editor/state/editorStore.test.ts
git commit -m "$(cat <<'EOF'
Add editor openPaths with outside-project read-only tabs.

EOF
)"
```

---

### Task 4: Read-only UI (badge, Monaco, context menu)

**Files:**
- Modify: `src/modules/editor/ui/MonacoEditorHost.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.test.tsx`
- Modify: `src/modules/editor/ui/useEditorSaveTriggers.ts` (⌘S no-op when active `readOnly` — if not already covered by `save` returning false)

**Interfaces:**
- Consumes: `buffers[id].readOnly`
- Produces: Lock icon (lucide `Lock`) or text `RO` beside label; `disabled` on Save / Save As menu items when `readOnly`; Monaco `readOnly: true`

- [ ] **Step 1: Failing strip tests**

```ts
it("shows RO affordance and disables Save/Save As for readOnly tab", async () => {
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: OUTSIDE }],
    activeTabId: OUTSIDE,
    buffers: {
      [OUTSIDE]: {
        content: "x",
        baselineContent: "x",
        dirty: false,
        status: "ready",
        errorMessage: null,
        saveError: null,
        readOnly: true,
      },
    },
  });
  render(
    <EditorTabStrip
      onRequestCloseTab={vi.fn()}
      onRequestSaveAs={vi.fn()}
      onRequestCloseOthers={vi.fn()}
      onRequestCloseAll={vi.fn()}
    />,
  );
  expect(screen.getByRole("tab", { name: /outside\.ts/i })).toBeTruthy();
  expect(screen.getByLabelText(/read-only/i)).toBeTruthy(); // aria-label on badge
  fireEvent.contextMenu(screen.getByRole("tab", { name: /outside\.ts/i }));
  expect(await screen.findByRole("menuitem", { name: /^save$/i })).toBeDisabled();
  expect(screen.getByRole("menuitem", { name: /save as/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx`

- [ ] **Step 3: Implement badge + disabled items + Monaco**

In strip tab label row:

```tsx
import { Lock } from "lucide-react";

const readOnly = buffers[tab.id]?.readOnly ?? false;
// ...
{readOnly ? (
  <Lock
    aria-label="Read-only"
    className="size-3 shrink-0 opacity-70"
  />
) : null}
```

Context menu:

```tsx
<ContextMenuItem
  disabled={readOnly}
  onClick={() => {
    if (isUntitledId(tab.id)) onRequestSaveAs(tab.id);
    else void saveTab(tab.id);
  }}
>
  Save
</ContextMenuItem>
<ContextMenuItem
  disabled={readOnly}
  onClick={() => onRequestSaveAs(tab.id)}
>
  Save As…
</ContextMenuItem>
```

Monaco:

```tsx
const readOnly = useEditorStore((s) =>
  s.activeTabId ? (s.buffers[s.activeTabId]?.readOnly ?? false) : false,
);
// options:
options={{
  minimap: { enabled: false },
  automaticLayout: true,
  fontSize: 13,
  readOnly,
}}
```

- [ ] **Step 4: Run strip + panel tests**

Run: `bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx src/modules/editor/ui/EditorPanel.test.tsx`

Expected: PASS (fix Panel/Monaco tests if they need `readOnly: false` on seeded buffers)

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/MonacoEditorHost.tsx \
  src/modules/editor/ui/EditorTabStrip.tsx \
  src/modules/editor/ui/EditorTabStrip.test.tsx
git commit -m "$(cat <<'EOF'
Show read-only editor chrome and disable writes in the UI.

EOF
)"
```

---

### Task 5: File picker + Open control + empty state

**Files:**
- Create: `src/modules/editor/infrastructure/editorFilePicker.ts`
- Create: `src/modules/editor/infrastructure/editorFilePicker.test.ts`
- Modify: `src/modules/editor/ui/EditorTabStrip.tsx` (+ tests)
- Modify: `src/modules/editor/ui/EditorPanel.tsx` (+ tests if needed)
- Modify: `src/modules/editor/ui/EditorCardHeader.tsx` only if Open lives there — prefer strip button `Open…` next to `+`

**Interfaces:**
- Produces:

```ts
export interface EditorFilePicker {
  pickFiles(): Promise<string[] | null>; // null = cancel; [] should not happen
}

export function createMemoryEditorFilePicker(result: string[] | null): EditorFilePicker;
export function createTauriEditorFilePicker(): EditorFilePicker;
```

Tauri impl:

```ts
export function createTauriEditorFilePicker(): EditorFilePicker {
  return {
    async pickFiles() {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true, directory: false });
      if (selected === null) return null;
      return Array.isArray(selected) ? selected : [selected];
    },
  };
}
```

Shared open action (exact helper name):

```ts
// src/modules/editor/ui/openEditorFiles.ts
export async function openEditorFilesFromPicker(
  picker: EditorFilePicker,
): Promise<void> {
  const paths = await picker.pickFiles();
  if (paths === null) return;
  await useEditorStore.getState().openPaths(paths);
}
```

- [ ] **Step 1: Picker unit tests**

```ts
it("memory picker returns paths", async () => {
  const picker = createMemoryEditorFilePicker(["/a.ts", "/b.ts"]);
  await expect(picker.pickFiles()).resolves.toEqual(["/a.ts", "/b.ts"]);
});

it("memory picker cancel returns null", async () => {
  const picker = createMemoryEditorFilePicker(null);
  await expect(picker.pickFiles()).resolves.toBeNull();
});
```

- [ ] **Step 2: Strip Open button test**

```ts
it("Open… button calls openPaths with picked files", async () => {
  const api = createMemoryEditorApi({
    files: { "/proj/a.ts": "a" },
  });
  useEditorStore.getState().bindApi(api);
  useEditorStore.setState({ projectRoot: "/proj" });
  const openPaths = vi.spyOn(useEditorStore.getState(), "openPaths");
  const picker = createMemoryEditorFilePicker(["/proj/a.ts"]);

  render(
    <EditorTabStrip
      filePicker={picker}
      onRequestCloseTab={vi.fn()}
      onRequestSaveAs={vi.fn()}
      onRequestCloseOthers={vi.fn()}
      onRequestCloseAll={vi.fn()}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: /open/i }));
  expect(openPaths).toHaveBeenCalledWith(["/proj/a.ts"]);
});
```

- [ ] **Step 3: Implement picker, helper, strip/empty Open UI**

- Add optional `filePicker?: EditorFilePicker` prop defaulting to `createTauriEditorFilePicker()`.
- Button label: `Open…` (ellipsis character `…`).
- Empty `EditorPanel` copy can include the same Open control or keep strip-only — **require strip Open…**; empty state text may say `Open a file from the explorer or Open…`.

Show `openBatchError` in `EditorPanel` above content when set:

```tsx
const openBatchError = useEditorStore((s) => s.openBatchError);
// ...
{openBatchError ? (
  <p className="mt-2 font-mono text-sm text-destructive">{openBatchError}</p>
) : null}
```

- [ ] **Step 4: Run tests**

Run: `bunx vitest run src/modules/editor/infrastructure/editorFilePicker.test.ts src/modules/editor/ui/EditorTabStrip.test.tsx src/modules/editor/ui/EditorPanel.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/infrastructure/editorFilePicker.ts \
  src/modules/editor/infrastructure/editorFilePicker.test.ts \
  src/modules/editor/ui/openEditorFiles.ts \
  src/modules/editor/ui/EditorTabStrip.tsx \
  src/modules/editor/ui/EditorTabStrip.test.tsx \
  src/modules/editor/ui/EditorPanel.tsx
git commit -m "$(cat <<'EOF'
Add Editor Open… file picker wired to openPaths.

EOF
)"
```

---

### Task 6: OS drop hit-testing (Editor vs Explorer) + drag highlight

**Files:**
- Modify: `src-tauri/src/lib.rs` (emit enter/over/leave with x/y; keep `explorer://drop` on Drop)
- Create: `src/modules/editor/ui/useEditorOsFileDrop.ts`
- Create: `src/modules/editor/ui/useEditorOsFileDrop.test.tsx` (or `.ts` with mocked listen)
- Modify: `src/modules/editor/ui/EditorTabStrip.tsx` — `data-editor-drop-zone=""` on the tablist root
- Modify: `src/modules/editor/ui/EditorPanel.tsx` or `EditorCardHeader.tsx` — mount the hook
- Modify: `src/modules/explorer/ui/ExplorerPanel.tsx` — skip copy when hit is editor zone
- Modify: `src/modules/explorer/ui/ExplorerPanel` tests if any cover drop

**Interfaces:**
- Drop payload stays `{ paths: string[]; x: number; y: number }`
- New event `explorer://drag` payload: `{ phase: "enter" | "over" | "leave"; paths: string[]; x: number; y: number }` (paths may be empty on over/leave if OS omits them — handle gracefully)
- Hit test: `document.elementFromPoint(x, y)?.closest("[data-editor-drop-zone]")`

- [ ] **Step 1: Extend Rust window drag emits**

In `lib.rs` `on_window_event`, handle Enter / Over / Leave / Drop. On Drop keep existing `explorer://drop`. On Enter/Over/Leave emit `explorer://drag`.

Sketch:

```rust
.on_window_event(|window, event| {
    use tauri::{DragDropEvent, WindowEvent};
    if let WindowEvent::DragDrop(drag) = event {
        match drag {
            DragDropEvent::Enter { paths, position } => {
                let _ = window.emit(
                    "explorer://drag",
                    serde_json::json!({
                        "phase": "enter",
                        "paths": paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>(),
                        "x": position.x,
                        "y": position.y,
                    }),
                );
            }
            DragDropEvent::Over(position) => {
                let _ = window.emit(
                    "explorer://drag",
                    serde_json::json!({
                        "phase": "over",
                        "paths": [],
                        "x": position.x,
                        "y": position.y,
                    }),
                );
            }
            DragDropEvent::Leave => {
                let _ = window.emit(
                    "explorer://drag",
                    serde_json::json!({
                        "phase": "leave",
                        "paths": [],
                        "x": 0,
                        "y": 0,
                    }),
                );
            }
            DragDropEvent::Drop { paths, position } => {
                let _ = window.emit(
                    "explorer://drop",
                    serde_json::json!({
                        "paths": paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>(),
                        "x": position.x,
                        "y": position.y,
                    }),
                );
            }
            _ => {}
        }
    }
})
```

Adjust enum variant shapes to match the Tauri 2 version in this repo (`cargo check` / compile errors). Do **not** invent variants — open `DragDropEvent` docs in the locked tauri crate if compile fails.

- [ ] **Step 2: Explorer skip test + implement**

In `handleExternalDrop`:

```ts
const el = document.elementFromPoint(payload.x, payload.y);
if (el?.closest("[data-editor-drop-zone]")) {
  return;
}
```

- [ ] **Step 3: Editor OS drop hook**

```ts
export function useEditorOsFileDrop(options?: {
  onDropPaths?: (paths: string[]) => Promise<boolean>;
  setOsDropActive?: (active: boolean) => void;
}) {
  useEffect(() => {
    let unDrop: UnlistenFn | undefined;
    let unDrag: UnlistenFn | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unDrop = await listen<{ paths: string[]; x: number; y: number }>(
        "explorer://drop",
        (event) => {
          const { paths, x, y } = event.payload;
          const hit = document.elementFromPoint(x, y)?.closest("[data-editor-drop-zone]");
          if (!hit) return;
          void (options?.onDropPaths ?? ((p) => useEditorStore.getState().openPaths(p)))(
            paths,
          );
        },
      );
      unDrag = await listen<{
        phase: string;
        paths: string[];
        x: number;
        y: number;
      }>("explorer://drag", (event) => {
        const { phase, x, y } = event.payload;
        if (phase === "leave") {
          options?.setOsDropActive?.(false);
          return;
        }
        const hit = document.elementFromPoint(x, y)?.closest("[data-editor-drop-zone]");
        options?.setOsDropActive?.(Boolean(hit));
      });
    })();
    return () => {
      unDrop?.();
      unDrag?.();
    };
  }, [options?.onDropPaths, options?.setOsDropActive]);
}
```

Wire in header/panel: combine `osDropActive` with existing MIME `dropActive` for `data-drop-active`.

Add unit test with mocked `listen` that fires a drop with coordinates over a rendered `[data-editor-drop-zone]` and asserts `openPaths` called; drop over empty document does not.

- [ ] **Step 4: Run tests**

Run: `bunx vitest run src/modules/editor/ui/useEditorOsFileDrop.test.tsx src/modules/editor/ui/EditorTabStrip.test.tsx`

Also run explorer tests if present for drop.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs \
  src/modules/editor/ui/useEditorOsFileDrop.ts \
  src/modules/editor/ui/useEditorOsFileDrop.test.tsx \
  src/modules/editor/ui/EditorTabStrip.tsx \
  src/modules/editor/ui/EditorPanel.tsx \
  src/modules/editor/ui/EditorCardHeader.tsx \
  src/modules/explorer/ui/ExplorerPanel.tsx
git commit -m "$(cat <<'EOF'
Route OS file drops on the editor strip to openPaths.

EOF
)"
```

---

### Task 7: Native File → Open… menu + CONTEXT

**Files:**
- Create: `src/modules/editor/ui/useEditorFileMenu.ts`
- Create: `src/modules/editor/ui/useEditorFileMenu.test.ts`
- Modify: app bootstrap (find where root layout mounts — e.g. `src/App.tsx` or shell root) to call the hook once
- Modify: `src/modules/editor/CONTEXT.md`

**Interfaces:**
- Menu: native **File** submenu with item **Open…** (accelerator `CmdOrCtrl+O` if the Menu API supports it easily; otherwise omit accelerator rather than invent custom shortcuts)
- On click → same `openEditorFilesFromPicker(createTauriEditorFilePicker())`

Prefer `@tauri-apps/api/menu` from the frontend (matches dialog plugin usage). If Menu API construction fails on this tauri build, fall back to a Rust `Menu` in `lib.rs` that emits `editor://open-requested` and have the hook listen — document which path you took in the commit body.

- [ ] **Step 1: Hook test with mocked Menu**

Mock `@tauri-apps/api/menu` to capture the Open handler; invoke it; assert picker → `openPaths`.

- [ ] **Step 2: Implement hook + mount once**

```ts
export function useEditorFileMenu(picker: EditorFilePicker = createTauriEditorFilePicker()) {
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const { Menu, MenuItem, PredefinedMenuItem, Submenu } = await import(
        "@tauri-apps/api/menu"
      );
      const openItem = await MenuItem.new({
        id: "editor-open",
        text: "Open…",
        action: () => {
          void openEditorFilesFromPicker(picker);
        },
      });
      const file = await Submenu.new({
        text: "File",
        items: [openItem],
      });
      const menu = await Menu.new({ items: [file] });
      if (!disposed) {
        await menu.setAsAppMenu();
      }
    })();
    return () => {
      disposed = true;
    };
  }, [picker]);
}
```

Adjust import names to the real Tauri 2 JS Menu API (verify against installed `@tauri-apps/api` types). Keep **Open…** text exact.

- [ ] **Step 3: Update CONTEXT.md**

Add terms:

**External / Read-only tab:** Absolute path outside `projectRoot`, opened via OS drop or Open…; `readOnly` buffer; view-only Monaco; Save/Save As disabled.  
_Avoid_: treating external paths as project files, writing them with `editor_write_file`

Update Editor Tab `_Avoid_` line that currently says “OS desktop file drops (Phase 2c)” — remove that avoid now that 2c ships.

- [ ] **Step 4: Run focused tests + broad editor suite**

Run: `bunx vitest run src/modules/editor`

Run: `cd src-tauri && cargo test editor::`

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/useEditorFileMenu.ts \
  src/modules/editor/ui/useEditorFileMenu.test.ts \
  src/modules/editor/CONTEXT.md \
  src/App.tsx
git commit -m "$(cat <<'EOF'
Add File → Open… menu and document external read-only tabs.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| `editor_read_external_file` | 1 |
| Under-root via `ensure_under_root` | 1 (`editor_is_under_root`) |
| Directory batch preflight | 1 + 3 |
| `readExternalFile` / probes on `EditorApi` | 2 |
| `openPaths` classify + `readOnly` | 3 |
| No-project / folder error copy | 3 |
| Monaco readOnly + badge + disabled Save/Save As | 4 |
| Open… control + dialog picker | 5 |
| `openBatchError` UI | 5 |
| OS drop → openPaths; Explorer skip when over strip | 6 |
| Drag highlight over strip | 6 |
| File → Open… menu | 7 |
| CONTEXT / ADR | 1 + 7 |
| Explorer MIME unchanged | (no change; regression via existing strip tests) |
| No Save As from RO / no external write | 3–4 (guards) |

---

## Plan self-review notes

- No TBD placeholders left for required behavior; Tauri `DragDropEvent` / Menu API variant names may need a one-line adjust to match the locked crate — implementers must follow compiler/types, not invent APIs.
- `openExternalReadOnly` may be file-local; tests go through `openPaths`.
- Memory `isUnderRoot` uses prefix rules for tests only; production uses Desktop.
