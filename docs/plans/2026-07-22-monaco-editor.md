# Monaco Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Monaco multi-file editor in the Editor main card (open/edit/save/auto-save), then persist + previews, then diff/split/palette, then LSP for TS/JS and Rust.

**Architecture:** Rust-owned path-scoped file I/O (`editor_*` commands); React `editorApi` + `editorStore` + `EditorPanel` with Monaco models per path. Later phases add persist, image/binary panes, DiffEditor/split/palette, and a Rust-managed LSP bridge to Monaco Language Client.

**Tech Stack:** Tauri 2, Rust, React 19, Zustand, `@monaco-editor/react`, Monaco Language Client (Phase 4), Vitest, Testing Library.

**Spec:** `docs/specs/2026-07-22-monaco-editor-design.md`

## Global Constraints

- Rust-first I/O: no `@tauri-apps/plugin-fs` in `src/modules/*`; all disk access via `editorApi` → Tauri commands.
- Reuse `src-tauri/src/explorer/path_scope.rs` for project-root checks.
- Text edit path: UTF-8 only; reject files larger than 2 MiB for read/write text commands.
- Auto-save default **on**, debounce ~1000ms after last edit while dirty.
- Dirty close: Confirm Discard / Cancel (no Save button in the confirm dialog).
- Persist only tab paths + active path + split layout — not unsaved buffer text.
- LSP first languages only: TypeScript/JavaScript language server + `rust-analyzer`.
- Plans/specs live under `docs/plans` and `docs/specs`.
- Prefer `bun run test` / targeted Vitest paths; Rust: `cargo test` in `src-tauri`.
- Ship Phase 1 → 2 → 3 → 4; do not start Phase 4 until 1–3 are green.

## File structure

| File | Responsibility |
| --- | --- |
| `src-tauri/src/editor/mod.rs` | Editor desktop module |
| `src-tauri/src/editor/error.rs` | Editor command errors |
| `src-tauri/src/editor/read_write.rs` | `editor_read_file` / `editor_write_file` |
| `src-tauri/src/editor/read_bytes.rs` | `editor_read_bytes` (Phase 2) |
| `src-tauri/src/editor/lsp.rs` | LSP process manager (Phase 4) |
| `src-tauri/src/lib.rs` | Register commands |
| `src-tauri/capabilities/default.json` | Allow new commands if required by schema |
| `src/modules/editor/api/editorApi.ts` | Typed invoke wrappers |
| `src/modules/editor/api/createMemoryEditorApi.ts` | In-memory API for tests |
| `src/modules/editor/api/editorApi.test.ts` | API contract tests (optional light) |
| `src/modules/editor/state/editorStore.ts` | Tabs, dirty, content, split, persist |
| `src/modules/editor/state/editorStore.test.ts` | Store behavior |
| `src/modules/editor/domain/editorFileKind.ts` | text / image / binary classification |
| `src/modules/editor/ui/EditorPanel.tsx` | Tabs + Monaco / preview host |
| `src/modules/editor/ui/EditorTabBar.tsx` | Tab strip + dirty dots + close |
| `src/modules/editor/ui/MonacoHost.tsx` | Monaco editor + models + save/auto-save |
| `src/modules/editor/ui/ImagePreview.tsx` | Image tab content (Phase 2) |
| `src/modules/editor/ui/BinaryNotice.tsx` | Non-editable binary (Phase 2) |
| `src/modules/editor/ui/EditorDiffHost.tsx` | DiffEditor (Phase 3) |
| `src/modules/editor/ui/EditorCommandPalette.tsx` | Palette overlay (Phase 3) |
| `src/modules/editor/CONTEXT.md` | Domain terms |
| `src/modules/shell/ui/panels/shellMainPanel.tsx` | Mount `EditorPanel` |
| `src/modules/explorer/ui/ExplorerTree.tsx` | `openTab` instead of `setOpenFilePath` |
| `src/modules/session/ui/sessionRoot.tsx` | Rehydrate editor store (Phase 2) |
| `src/modules/session/state/sessionReset.ts` | Reset editor store (Phase 2) |
| `package.json` / Vite config | Monaco dependency + workers |

---

# Phase 1 — Core editing + auto-save

### Task 1: Rust `editor_read_file` / `editor_write_file`

**Files:**
- Create: `src-tauri/src/editor/mod.rs`
- Create: `src-tauri/src/editor/error.rs`
- Create: `src-tauri/src/editor/read_write.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json` (only if command allow-list requires it)

**Interfaces:**
- Consumes: `explorer::path_scope::ensure_under_root` (make `path_scope` reachable — either `pub use` from explorer or move shared helper; prefer calling via `crate::explorer::path_scope` if already public, else `pub` the module)
- Produces:
  - `editor_read_file(input: { projectRoot, path }) -> Result<{ content: String }, EditorError>`
  - `editor_write_file(input: { projectRoot, path, content }) -> Result<(), EditorError>`
  - Max text size: `2 * 1024 * 1024` bytes

- [ ] **Step 1: Write failing Rust tests** in `read_write.rs` `#[cfg(test)]`

```rust
#[test]
fn read_file_under_root_returns_utf8() {
    // tempdir with project/root/hello.txt = "hi"
    // assert content == "hi"
}

#[test]
fn read_file_outside_root_errors() { /* .. */ }

#[test]
fn write_file_round_trips() { /* .. */ }

#[test]
fn rejects_non_utf8() { /* .. */ }

#[test]
fn rejects_oversized() { /* write > 2MiB file, read errors */ }
```

- [ ] **Step 2: Run tests — expect FAIL** (module missing)

Run: `cd src-tauri && cargo test editor:: -- --nocapture`

- [ ] **Step 3: Implement module + register commands**

Mirror explorer input style (`camelCase` serde). Share path scope with explorer. Register in `generate_handler!`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd src-tauri && cargo test editor:: -- --nocapture`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/editor src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "$(cat <<'EOF'
Add editor_read_file and editor_write_file commands.

Path-scoped UTF-8 text I/O for the Monaco editor surface.
EOF
)"
```

---

### Task 2: `editorApi` + memory fake

**Files:**
- Create: `src/modules/editor/api/editorApi.ts`
- Create: `src/modules/editor/api/createMemoryEditorApi.ts`
- Create: `src/modules/editor/api/editorApi.test.ts`

**Interfaces:**
- Consumes: `@tauri-apps/api/core` `invoke`
- Produces:

```ts
export interface EditorApi {
  readFile(projectRoot: string, path: string): Promise<{ content: string }>;
  writeFile(projectRoot: string, path: string, content: string): Promise<void>;
}
export function createTauriEditorApi(): EditorApi;
export function createMemoryEditorApi(initial?: Record<string, string>): EditorApi;
export const defaultEditorApi: EditorApi; // Tauri impl (tests mock module like explorer)
```

- [ ] **Step 1: Write failing test** — memory API round-trip

```ts
it("memory api reads and writes by path", async () => {
  const api = createMemoryEditorApi({ "/p/a.ts": "x" });
  expect(await api.readFile("/p", "/p/a.ts")).toEqual({ content: "x" });
  await api.writeFile("/p", "/p/a.ts", "y");
  expect((await api.readFile("/p", "/p/a.ts")).content).toBe("y");
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `bun run test src/modules/editor/api/editorApi.test.ts`

- [ ] **Step 3: Implement API + memory fake**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Add editorApi invoke wrappers and memory fake.

EOF
)"
```

---

### Task 3: Expand `editorStore` for multi-tab + dirty

**Files:**
- Modify: `src/modules/editor/state/editorStore.ts`
- Create: `src/modules/editor/state/editorStore.test.ts`
- Update call sites still using `setOpenFilePath` / `openFilePath` after Task 5 (keep a thin `setOpenFilePath` alias → `openTab` temporarily if needed to avoid breaking mid-plan)

**Interfaces:**
- Produces store fields/actions:

```ts
tabs: { path: string }[];
activePath: string | null;
dirtyByPath: Record<string, boolean>;
contentByPath: Record<string, string>;
savedContentByPath: Record<string, string>;
loadingByPath: Record<string, boolean>;
errorByPath: Record<string, string | undefined>;
openTab(path: string): void; // activate existing or append + set active
setActivePath(path: string | null): void;
closeTab(path: string): void; // caller handles dirty confirm before calling
markDirty(path: string, content: string): void;
markClean(path: string, content: string): void;
setTabContent(path: string, content: string): void;
setTabError(path: string, error: string | undefined): void;
setTabLoading(path: string, loading: boolean): void;
resetEditor(): void;
```

- [ ] **Step 1: Write failing store tests** (open, activate existing, dirty, close switches active)

- [ ] **Step 2: Run — expect FAIL**

Run: `bun run test src/modules/editor/state/editorStore.test.ts`

- [ ] **Step 3: Implement store** (replace single `openFilePath` with tab model)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Expand editorStore for multi-tab dirty state.

EOF
)"
```

---

### Task 4: Monaco host + EditorPanel + auto-save

**Files:**
- Modify: `package.json` (add `@monaco-editor/react`, `monaco-editor`)
- Modify: Vite config if workers need `vite-plugin-monaco-editor` or documented worker URL setup
- Create: `src/modules/editor/ui/MonacoHost.tsx`
- Create: `src/modules/editor/ui/EditorTabBar.tsx`
- Create: `src/modules/editor/ui/EditorPanel.tsx`
- Create: `src/modules/editor/ui/EditorPanel.test.tsx`
- Modify: `src/modules/shell/ui/panels/shellMainPanel.tsx`
- Create: `src/modules/editor/CONTEXT.md`

**Interfaces:**
- Consumes: `EditorApi`, `useEditorStore`, active project root from `useProjectStore` (same pattern as explorer)
- Produces: `EditorPanel` props `{ editorApi?: EditorApi }` for tests
- Auto-save: `useEffect` / debounce 1000ms on dirty active text tab → `writeFile` → `markClean`
- ⌘/Ctrl+S: same save path immediately
- Close tab with dirty: `window.confirm` Discard?/Cancel before `closeTab`

- [ ] **Step 1: Write failing UI tests** with memory API — open path shows content; edit marks dirty; fake timers flush auto-save

Mock Monaco lightly (stub component that renders a textarea with `aria-label="monaco-editor"`) in tests so jsdom does not load the full editor — keep a `__monacoTestHook` prop or inject `EditorComponent` for tests.

- [ ] **Step 2: Run — expect FAIL**

Run: `bun run test src/modules/editor/ui/EditorPanel.test.tsx`

- [ ] **Step 3: Install Monaco, implement panel/tab bar/host, replace shell stub**

Empty state copy: `Open a file from the explorer`. Show basename on tabs; dirty dot when `dirtyByPath[path]`.

- [ ] **Step 4: Run editor + shell tests — expect PASS**

Run: `bun run test src/modules/editor src/modules/shell/ui/shellScreen.test.tsx`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Add Monaco EditorPanel with tabs and auto-save.

EOF
)"
```

---

### Task 5: Explorer opens tabs

**Files:**
- Modify: `src/modules/explorer/ui/ExplorerTree.tsx`
- Modify: `src/modules/explorer/ui/ExplorerTree.test.tsx`
- Modify any remaining `openFilePath` references

**Interfaces:**
- Consumes: `useEditorStore.getState().openTab(path)`
- Produces: file click → editor card + tab open (load content happens in EditorPanel effect)

- [ ] **Step 1: Update explorer test** to expect `openTab` / activePath instead of only `openFilePath`

- [ ] **Step 2: Run — expect FAIL** if production still uses old API

- [ ] **Step 3: Switch `openFile` helper to `openTab`

- [ ] **Step 4: Run explorer + editor tests — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Open explorer files as editor tabs.

EOF
)"
```

---

### Task 6: Phase 1 verification

- [ ] **Step 1:** `bun run test`
- [ ] **Step 2:** `cd src-tauri && cargo test`
- [ ] **Step 3:** Manual smoke in `bun run tauri dev` — open 2 files, edit, wait for auto-save, ⌘S, dirty close confirm, find (⌘F)
- [ ] **Step 4:** Fix any failures; commit if needed

---

# Phase 2 — Persist + image / binary preview

### Task 7: Classify file kind

**Files:**
- Create: `src/modules/editor/domain/editorFileKind.ts`
- Create: `src/modules/editor/domain/editorFileKind.test.ts`

**Interfaces:**
- Produces: `getEditorFileKind(path: string): 'text' | 'image' | 'binary'`
- Image extensions: `png jpg jpeg gif webp svg ico bmp` (case-insensitive)

- [ ] TDD helper → commit

---

### Task 8: `editor_read_bytes` + API

**Files:**
- Create: `src-tauri/src/editor/read_bytes.rs`
- Modify: `editor/mod.rs`, `lib.rs`
- Extend: `editorApi.ts`, memory fake

**Interfaces:**
- Produces: `editor_read_bytes → { base64: string, mimeType: string }` (mime from extension)
- Size cap for images: e.g. 10 MiB

- [ ] TDD Rust + TS → commit

---

### Task 9: Persist editor tabs + session wiring

**Files:**
- Modify: `editorStore.ts` (zustand `persist` + `partialize`)
- Modify: `sessionRoot.tsx` rehydrate list
- Modify: `sessionReset.ts` + tests
- Create/modify: hydrate effect to `readFile` restored text tabs; drop missing paths

**Interfaces:**
- Persist: `{ tabs, activePath, split }` only (split may be null until Phase 3)
- `resetEditor()` included in session reset

- [ ] TDD persist partialize + reset → commit

---

### Task 10: Image preview + binary notice UI

**Files:**
- Create: `ImagePreview.tsx`, `BinaryNotice.tsx`
- Modify: `EditorPanel.tsx` to branch on `getEditorFileKind`
- Tests for routing

- [ ] TDD → commit → manual smoke (open `.png`, open `.exe` or similar)

---

# Phase 3 — Diff, split, command palette

### Task 11: Diff vs saved

**Files:**
- Create: `EditorDiffHost.tsx`
- Store: `diffPath: string | null` (or `viewMode: 'edit' | 'diff'`)
- Commands later call `setDiffPath(activePath)` / clear

- [ ] TDD: entering diff shows original vs dirty; exit restores edit → commit

---

### Task 12: Split panes

**Files:**
- Store: `split: null | { orientation: 'horizontal' | 'vertical'; secondaryPath: string | null }`, `focusedPane: 'primary' | 'secondary'`
- Modify: `EditorPanel` layout — two Monaco hosts when split
- Activating a tab sets path on focused pane

- [ ] TDD split/unsplit + focus → commit

---

### Task 13: Command palette

**Files:**
- Create: `EditorCommandPalette.tsx`
- Commands (minimum): Save, Close Tab, Compare with Saved, Split Right, Split Down, Unsplit, plus “Go to …” open tabs
- Shortcut: ⌘/Ctrl+Shift+P when editor card focused/visible

- [ ] TDD open/filter/run command → commit → manual smoke

---

# Phase 4 — LSP

### Task 14: Rust LSP process manager

**Files:**
- Create: `src-tauri/src/editor/lsp.rs`
- Commands: `editor_lsp_start`, `editor_lsp_stop`, `editor_lsp_send`
- Event: `editor://lsp-message` with `{ serverId, message }` (raw JSON-RPC string or parsed value)
- Resolve binaries from PATH; error if missing
- Workspace root = `projectRoot`

- [ ] Unit-test start fails clearly when binary missing (mockable command lookup if needed) → commit

---

### Task 15: Monaco Language Client bridge

**Files:**
- Add MLC dependencies as needed
- Wire client transport to `editor_lsp_send` + `editor://lsp-message`
- Start TS/JS server for `.ts/.tsx/.js/.jsx`; rust-analyzer for `.rs`
- Stop servers on project change / unmount

- [ ] Manual verify hover/completion/diagnostics when binaries installed; graceful no-op when not → commit

---

### Task 16: Final verification

- [ ] `bun run test`
- [ ] `cd src-tauri && cargo test`
- [ ] Manual checklist from spec (tabs, auto-save, persist restart, image, diff, split, palette, LSP)
- [ ] Update `src/modules/editor/CONTEXT.md` if terms drifted
- [ ] Do **not** commit unless asked, or commit a final docs tweak if the implementing agent was instructed to commit per-task

---

## Execution notes

- Prefer **subagent-driven-development**: one implementer subagent per Task, then a quick review before the next Task.
- Use an isolated git worktree / feature branch before Task 1 (`feat/monaco-editor` or similar). Do not implement on `main` without explicit consent.
- After all tasks: use **finishing-a-development-branch** for merge/PR options.
