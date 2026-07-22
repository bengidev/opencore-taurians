# Editor Tabs — Phase 2c design

Date: 2026-07-22  
Status: Approved for implementation planning  
Scope: **Phase 2c only** (OS file drops; outside-project **read-only** tabs; File → Open… + Editor Open control). Builds on Phase 2b / tab context menu.

Related: Phase 2b — `docs/specs/2026-07-22-editor-tabs-phase2b-design.md`. Roadmap slice from Phase 2a — `docs/specs/2026-07-22-editor-tabs-phase2a-design.md`.

## Goal

Let users open files from the OS (Finder/Explorer drop or Open dialog) into the Editor. Paths under `projectRoot` stay editable project tabs. Paths **outside** the project open as **view-only** tabs: Monaco non-editable, writes disabled, subtle lock/RO chrome.

## Decisions (locked)

| Topic | Choice |
| ----- | ------ |
| Scope | Full roadmap 2c: OS drops **and** outside-project read-only |
| Read-only meaning | **View-only** — Monaco `readOnly`; Save / Save As / ⌘S disabled or no-ops |
| Multi-file | Open **all** files in the gesture |
| Folders | If **any** selected/dropped path is a directory → **reject the whole batch**; brief error; open nothing |
| Outside entry points | OS drop onto tab strip **and** Open… (native **File → Open…** + Editor control, same pipeline) |
| RO chrome | Subtle lock or “RO” badge on the tab; context menu disables Save / Save As |
| Open pipeline | **Classify-on-open**: one `openPaths(paths[])` that routes under-root vs external |
| Desktop I/O | New **external read** only; write/create remain project-scoped |
| OS drop mechanism | Tauri window `onDragDropEvent` (absolute paths) — not HTML5 `File` path hacks |
| Explorer MIME drop | Unchanged (project file MIME → existing `openFile`) |
| Save As from RO | **Out of scope** — no escape hatch to copy external into project in 2c |

## Roadmap context

| Slice | Ships |
| ----- | ----- |
| **2a** | Tab strip, multi-buffer, Explorer open/DnD, dirty close |
| **2b** | Untitled, Save As, `editor_create_file` |
| **2c** | OS drops; outside-project read-only; File → Open… |

## Architecture

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Desktop | `src-tauri/src/editor/` | `editor_read_external_file`; optional pick-files command or thin dialog infra |
| API | `src/modules/editor/api/` | `readExternalFile`; Open dialog wrapper for UI |
| State | `editorStore` | `openPaths` classify; per-buffer/tab `readOnly`; RO never write/create |
| UI | Tab strip, Monaco host, context menu, File menu, Open control | Drag-drop events; badge; disable write actions; Monaco `readOnly` |
| Shell | App menu | Minimal native **File → Open…** |

**Boundaries**

- Rust-first: no `@tauri-apps/plugin-fs` in `src/modules/*`.
- Dialog may use thin infrastructure (same pattern as folder picker) or a Desktop pick command; feature modules call an API only.
- Monaco stays UI-only; never reads/writes disk.
- Domain language: shell **main cards** ≠ file **tabs**.

## Tab / buffer model

**Identity:** Tab id remains `untitled:N` or an absolute file path. Outside-project tabs use the absolute path as id (same as project path tabs).

**Addition:** Each path-backed buffer (or tab metadata) carries `readOnly: boolean`. `true` for outside-project opens; `false` for project opens and Untitled (Untitled stays non-readonly but still cannot `writeFile` until Save As).

**Conceptual store shape (delta from 2b)**

```text
buffers: Record<id, {
  ...existing fields...
  readOnly: boolean   // true ⇒ view-only external tab
}>
```

Helpers: `isExternalReadOnly(id)` (or read `buffers[id].readOnly`); `tabLabel` unchanged (basename / Untitled-N).

### Classify-on-open

**Prerequisite:** `projectRoot` must be set. If no project is open, Open… / OS drop show a brief error and open nothing (Explorer MIME drop already no-ops without a root).

Given `projectRoot` and `paths: string[]`:

1. **Directory preflight:** If any path is an existing directory → abort batch; brief error (“Folders can’t be opened here”); open **none**. Missing paths are **not** treated as directories — they proceed to per-path open and become `error` tabs.
2. For each path in order:
   - If already open → focus that tab (preserve existing `readOnly`); clear stale `saveError` like 2a.
   - Else if path is under `projectRoot` (same semantics as Desktop `ensure_under_root`) → append writable tab; load via `editor_read_file`.
   - Else → append read-only tab (`readOnly: true`); load via `editor_read_external_file`.
3. Set `activeTabId` to the **last path in the batch** that was focused or appended (including tabs that landed in `error`).

Mixed under/outside batches are allowed: each path classified independently (unless step 1 aborts).

**Under-root check:** Implement with a small helper mirroring `path_scope` rules, or a thin Desktop probe — must not invent looser/tighter rules than `ensure_under_root`.

### Behaviors

| Action | Result |
| ------ | ------ |
| OS drop files onto strip | Resolve paths via Tauri drag-drop → `openPaths` |
| Explorer MIME drop | Unchanged → `openFile(projectRoot, path)` (writable) |
| File → Open… / Editor Open | Multi-select files dialog → `openPaths` |
| Active RO tab | Monaco `readOnly`; never dirty from edits; ⌘S / leave save no-op for that tab |
| Context menu on RO | **Save** / **Save As…** disabled; Close / Others / All unchanged |
| Project / Untitled tabs | Unchanged from 2b + context menu |
| Re-open same external path | Focus; do not reload unless buffer `status === 'error'` (same as 2a) |
| Read failure | That tab `error` (missing / binary / too large / not a file after preflight); other paths in batch still attempt open |
| Quit / dirty | RO tabs are never dirty; quit path unchanged for project + Untitled |

## Desktop: `editor_read_external_file`

**Input:** `{ path }` (camelCase) — absolute filesystem path. **No** `projectRoot`; **no** `ensure_under_root`.

| Case | Result |
| ---- | ------ |
| Regular file, UTF-8, ≤ `MAX_EDITOR_FILE_BYTES` (same 2 MiB as project read) | Ok(content) |
| Missing | `NotFound` |
| Directory / not a file | `NotAFile` |
| Oversize | `TooLarge` |
| NUL / non-UTF8 | `BinaryOrNonUtf8` |

Reuse existing `EditorError` variants where they fit. **Never** write through this command.

Project `editor_read_file` / `editor_write_file` / `editor_create_file` remain root-scoped and must still reject outside paths.

### Open dialog

Native multi-file picker (files only). Cancel → no-op. Returned paths feed `openPaths`. Folder selection is not offered; if the platform still returns a directory, treat like drop folder rules (reject whole batch).

## UI

- **Tab strip:** Listen for Tauri drag-drop on the Editor region/strip; highlight drop target when OS files hover (in addition to existing Explorer MIME highlight).
- **Badge:** Lock icon or compact “RO” on read-only tabs.
- **Monaco:** `options.readOnly` when active buffer `readOnly`.
- **Open control:** Visible Editor affordance (e.g. strip or empty-state) that opens the same dialog as **File → Open…**.
- **File menu:** Minimal native menu with **Open…** (and standard app items if already required by the shell — do not invent a full File menu beyond Open for 2c).

## Testing

- **Desktop:** External read accepts outside file; rejects directory / missing / binary / oversize; project write still rejects outside
- **Store:** Classify under vs outside; RO never calls write/create; mixed batch; directory aborts all; re-focus
- **UI:** Badge; Save/Save As disabled; Monaco readOnly; Open control + menu share pipeline; folder drop rejected
- **Regression:** Explorer MIME drop still opens project files

## Non-goals (2c)

- Editing or saving outside-project files on disk
- Save As from a RO tab into `projectRoot`
- Recursive folder open / import tree
- Tab persistence, reorder, split panes
- Changing Explorer “New File” or project create flows
- Native OS **save** dialog

## Module layout (touch points)

```text
src-tauri/src/editor/          # read_external.rs (or extend read) + register
src-tauri/…                    # File menu Open… wiring
src/modules/editor/api/        # readExternalFile + memory double
src/modules/editor/state/      # openPaths, readOnly on buffers
src/modules/editor/ui/         # drop events, badge, Monaco RO, Open control
src/modules/editor/CONTEXT.md  # external / read-only terms
```

## Spec coverage vs roadmap

| Roadmap ask | Where it lands |
| ----------- | -------------- |
| OS (Finder/Explorer) file drops | Tauri drag-drop → `openPaths` |
| Outside-project read-only open | Classify + `editor_read_external_file` + view-only UI |
| External read path; write disabled | Desktop external read; RO never write/create |
