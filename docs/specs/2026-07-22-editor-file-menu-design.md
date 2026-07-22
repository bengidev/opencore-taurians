# Editor File Menu Design

**Date:** 2026-07-22  
**Status:** Approved  
**Branch:** `feat/monaco-editor`  
**Related:** Phase 2c (`docs/specs/2026-07-22-editor-tabs-phase2c-design.md`)

## Goal

Users open and save editor files from the native **File** menu (next to **OpenCore Taurians** on the OS menu bar), not from an **Open…** control on the editor tab strip. Dirty (unsaved) path-backed buffers show the same trailing **`•`** on editor tabs and on Explorer file **and ancestor folder** rows.

## Decisions

| Topic | Choice |
| ----- | ------ |
| Placement | Native app menu **File** submenu (expand existing `useEditorFileMenu`) |
| Strip Open… | **Remove** |
| Strip `+` | **Keep** (also reachable via File → New) |
| Tab context Save / Save As… | **Keep** |
| Menu scope | File only (no Edit/View in this change — same Phase 2c tradeoff) |
| Dirty indicator | Trailing `•` on editor tabs (existing) **and** Explorer file + ancestor folder rows |
| Dirty Explorer scope | Path-backed dirty buffers under `projectRoot` only; mark file + ancestors through root |

## Native File menu

| Item | Accelerator | Action |
| ---- | ----------- | ------ |
| New | `CmdOrCtrl+N` | `openUntitled()` (same as strip `+`) |
| Open… | `CmdOrCtrl+O` | Existing multi-file picker → `openPaths` |
| Save | `CmdOrCtrl+S` | Same as today’s ⌘S path: Untitled → `requestSaveAs(activeTabId)`; else `save()`; read-only / no active tab → no-op |
| Save As… | `CmdOrCtrl+Shift+S` | `requestSaveAs(activeTabId)` when a non–read-only active tab exists |

### Enablement

- **New / Open…:** always enabled. Open… still surfaces brief `openBatchError` via `openPaths` when there is no `projectRoot` (or on directory batch abort).
- **Save / Save As…:** disabled (or no-op if invoked) when there is no active tab, or the active buffer is `readOnly`.

## UI changes

- Remove the **Open…** button from `EditorTabStrip` (and its `filePicker` prop / related tests).
- Empty-state copy in `EditorPanel`: point users to explorer or **File → Open…** (not strip Open…).
- Keep strip **`+`** and per-tab context **Save / Save As…**.

## Wiring

- Expand `useEditorFileMenu` only; still mounted once from `App`.
- Keep stable default picker (`useRef`) so App re-renders do not rebuild the menu.
- **New** → `useEditorStore.getState().openUntitled()`.
- **Open…** → existing `openEditorFilesFromPicker`.
- **Save** → share logic with `useEditorSaveTriggers` ⌘S (extract a small helper if needed so menu and keyboard stay in sync).
- **Save As…** → `requestSaveAs(activeTabId)` via the existing Save As bridge; dialog remains owned by `EditorCardHeader`.

## Dirty `•` (Editor + Explorer)

**Source of truth:** `editorStore.buffers[id].dirty` for **path-backed** tabs under `projectRoot` only (not Untitled; not outside-project / `readOnly` tabs).

**Rules**
- For each dirty qualifying path: include that file path and every ancestor directory path up through `projectRoot` (include `projectRoot` when it appears as a tree row).
- Display: append ` •` to the visible name — same pattern as tabs today (`${label} •`).
- Clears when the buffer is no longer dirty (save / Don’t save / close / Save As retarget).

**Wiring**
- Helper `collectDirtyExplorerPaths(buffers, projectRoot): Set<string>`.
- `ExplorerEntryRow` (files and folders) appends ` •` when `set.has(entry.path)`.
- Editor tabs keep the existing trailing `•` (no visual change required).

## Out of scope

- Edit / View / full macOS standard menus.
- Removing strip `+` or tab context menus.
- Save As from read-only (outside-project) tabs into the project.
- Changing OS drop / Explorer MIME open behavior.
- Different dirty glyphs, window-title dirty mark, or folder dirty without an open dirty descendant.

## Testing

- Extend `useEditorFileMenu` tests for New, Open…, Save, Save As… (including RO / no-tab cases).
- Remove strip Open… tests; keep `+` and context-menu coverage.
- Update empty-state copy assertion.
- If a shared Save helper is extracted, cover Untitled → Save As vs path → `save()` once there.
- Unit tests for `collectDirtyExplorerPaths` (file + ancestors; Untitled / outside ignored; clear when not dirty).
- ExplorerTree test: dirty open path → file and ancestor folder labels show `•`.

## Acceptance

1. Native File has New / Open… / Save / Save As… with the accelerators above.
2. Strip has no Open…; `+` and tab context menus unchanged.
3. Empty state points at File → Open….
4. Read-only / no-tab Save paths stay no-ops; Open… still uses `openPaths` + brief `openBatchError`.
5. Dirty path-backed tabs show `•` on the tab and on the Explorer file row plus ancestor folders; mark clears when no longer dirty.
