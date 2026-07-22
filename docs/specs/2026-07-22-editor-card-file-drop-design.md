# Editor Card File Drop Design

**Date:** 2026-07-22  
**Status:** Approved  
**Branch:** `feat/monaco-editor`  
**Related:** Phase 2c OS drop (`docs/specs/2026-07-22-editor-tabs-phase2c-design.md`)

## Goal

Dragging a **file** from the in-app Explorer **or** from the OS file manager (Finder) onto the **Editor main card** opens that file as an editor tab. The drop target is the whole card — not only the tab strip.

## Decisions

| Topic | Choice |
| ----- | ------ |
| Sources | Both: in-app Explorer MIME drag and OS / Finder file drop |
| Drop target | Entire Editor main card (tab strip + Monaco / empty / loading / error) |
| Approach | Expand existing `data-editor-drop-zone` to the card wrapper (Approach A) |
| Folder in drop | Abort whole batch; brief `openBatchError`; open nothing (same as Open… / `openPaths`) |
| No `projectRoot` | Brief error; open nothing (existing `openPaths` / Open… behavior) |
| Focus | On successful open, switch to Editor main card if it is not already active |

## Behavior

### In-app Explorer → Editor

- File rows remain draggable with `application/x-explorer-file-path` (unchanged).
- Drop anywhere on the Editor card opens that path as a writable under-root tab via existing `openFile(projectRoot, path)`.
- Folder rows stay non-draggable.

### OS / Finder → Editor

- Window `DragDrop` → `explorer://drop` / `explorer://drag` unchanged.
- Hit-test uses `document.elementFromPoint` + `closest("[data-editor-drop-zone]")`.
- On hit: call `openPaths(paths)` — under-root writable; outside-project read-only.
- Explorer copy-on-drop continues to skip when the drop hits `[data-editor-drop-zone]`.

### Shared rules

| Case | Result |
| ---- | ------ |
| File(s) only, with `projectRoot` | Open tab(s); focus Editor card |
| Any path is a directory | Abort batch; set brief `openBatchError`; open nothing |
| Missing `projectRoot` | Brief error; open nothing |
| Drop on Chat / Terminal | No editor open (zone not present) |

### Drop highlight

- Card shows active drop styling while Explorer MIME drag is over it or OS drag hover hit-tests the zone (`data-drop-active` / existing OS active state).

## Wiring

1. Move `data-editor-drop-zone` from the tab strip alone onto a wrapper that covers **EditorCardHeader + EditorPanel** (the editor card content inside the shell editor `section`).
2. Move HTML5 Explorer MIME `dragOver` / `dragLeave` / `drop` handlers from `EditorTabStrip` to that wrapper (strip no longer owns drop alone).
3. Keep `useEditorOsFileDrop` as-is — enlarging the marked zone is sufficient for Finder.
4. Do not change `openPaths` classify-on-open, read-only rules, or desktop drag emit APIs.

Likely touch points:

| Path | Role |
| ---- | ---- |
| `src/modules/shell/ui/panels/shellMainPanel.tsx` and/or editor card wrapper | Own `data-editor-drop-zone` + MIME handlers + highlight |
| `src/modules/editor/ui/EditorTabStrip.tsx` | Remove strip-only zone/handlers (or keep strip as visual child only) |
| `src/modules/editor/ui/useEditorOsFileDrop.ts` | Unchanged hit-test contract |
| Tests for strip / OS drop / Explorer skip-copy | Assert drops over panel body open tabs |

## Out of scope

- Dropping onto Chat or Terminal cards.
- Making Explorer folder rows draggable.
- Changing outside-project read-only classification.
- New Tauri commands or FS watchers.
- Drag-reorder of tabs.

## Testing

- OS drop whose coordinates hit the Monaco / empty panel body (not only the strip) → `openPaths` called; tab opens.
- Explorer MIME drop on panel body → tab opens; Editor card focused if needed.
- OS drop with a directory in the batch → abort + `openBatchError`; no new tabs.
- OS / Explorer drop missing the editor zone → no editor open (Explorer copy path unchanged when applicable).
- Existing strip / menu open paths remain green.
