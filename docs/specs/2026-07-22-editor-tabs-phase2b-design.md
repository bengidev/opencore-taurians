# Editor Tabs — Phase 2b design

Date: 2026-07-22  
Status: Approved for implementation planning  
Scope: **Phase 2b only** (Untitled buffers, enabled `+`, Save As, Desktop create-under-root). Phase 2c remains deferred.

Related: Phase 2a — `docs/specs/2026-07-22-editor-tabs-phase2a-design.md` (multi-tab strip for project files).

## Goal

Enable the Editor tab strip’s `+` control to open **Untitled** buffers, and let users materialize or retarget files through an in-app **Save As** dialog constrained to `projectRoot`. Path-backed save / leave / quit-auto-save stay as in 2a; Untitled never writes to disk until Save As succeeds.

## Decisions (locked)

| Topic | Choice |
| ----- | ------ |
| Approach | Extend tab identity (`untitled:N` \| absolute path) + one Desktop create command |
| `+` | Enabled — append empty Untitled tab |
| Untitled identity | Synthetic keys `untitled:1`, `untitled:2`, … (never filesystem paths) |
| Empty Untitled | Starts **clean** until first edit |
| ⌘S / leave on Untitled | Always open Save As (no silent write) |
| Save As scope | Untitled **and** path-backed tabs |
| After Save As | **Retarget** the same tab’s id to the new absolute path |
| Overwrite | Confirm, then replace file contents and retarget |
| Path picker | In-app dialog: folder under `projectRoot` + filename |
| Create parents | **No** `mkdir -p` in 2b — parent directory must already exist |
| Quit | Path dirty tabs: auto-save as 2a. Dirty Untitled: Save As / Don’t save / Cancel each |
| `editor_write_file` | Unchanged (exist-only overwrite) |

## Roadmap context

| Slice | Ships |
| ----- | ----- |
| **2a** | Tab strip, multi-buffer store, Explorer open/DnD, dirty close, disabled `+` |
| **2b** | Enabled `+`, Untitled, Save As, `editor_create_file` |
| **2c** | OS file drops; outside-project read-only tabs |

## Architecture

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Desktop | `src-tauri/src/editor/` | New `editor_create_file`; write unchanged |
| API | `src/modules/editor/api/` | `createFile` on `EditorApi` + memory double |
| State | `editorStore` | Tab ids = `untitled:N` or abs path; Save As retarget; Untitled-aware save/quit |
| UI | Tab strip, Save As dialog, close/quit prompts | Enable `+`; route Untitled Save → Save As |
| Explorer | — | No open-path change; FS watch surfaces new files |

**Boundaries**

- Rust-first: no `@tauri-apps/plugin-fs` in `src/modules/*`.
- Monaco stays UI-only.
- Domain language: shell **main cards** ≠ file **tabs**; do not call the Editor card a “tab”.

## Tab / buffer model

**Identity:** Each tab is keyed by `id: string` — either `untitled:N` or an absolute file path under `projectRoot`.

**Conceptual store shape**

```text
tabs: { id: string }[]
activeTabId: string | null
buffers: Record<id, {
  content: string
  baselineContent: string
  dirty: boolean
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'error'
  errorMessage: string | null
  saveError: string | null
}>
nextUntitled: number
projectRoot: string | null
api: EditorApi | null
```

Prefer renaming 2a’s `activePath` → `activeTabId` (and `path` → `id` on tab entries) so callers do not treat Untitled ids as disk paths. Helpers: `isUntitledId(id)`, `tabLabel(id)` → `Untitled-N` or basename.

### Behaviors

| Action | Result |
| ------ | ------ |
| `+` | Allocate `untitled:N`, append tab, activate, empty `ready` buffer, clean until edit |
| Edit | Updates **active** buffer only; dirty when `content !== baselineContent` |
| ⌘S / leave, path tab | Unchanged from 2a (`save` / `saveIfDirty` via `editor_write_file`) |
| ⌘S / leave, Untitled | Open Save As. Leave does **not** call Desktop. Card may switch away; dialog stays until resolved. Cancel → Untitled remains dirty |
| Save As | In-app: folder under root (default: project root, or dirname of path tab) + filename. Confirm → `createFile`. Success → retarget. Cancel → no-op |
| Target exists | Confirm overwrite → then `createFile` overwrite |
| Target already open as another tab | After successful Save As: close that other tab; Save As source becomes the path tab (source content wins) |
| Dirty close, path | 2a dialog; **Save** = `writeFile` then close |
| Dirty close, Untitled | Same chrome; **Save** = Save As then close on success; failure keeps tab + dialog + `saveError` |
| Quit | (1) Auto-save all dirty **path** tabs in open order; on failure prevent quit as 2a. (2) For each remaining dirty Untitled in open order: Save As / Don’t save / Cancel. Cancel or Save As failure → prevent quit and stop. Don’t save → close that Untitled |
| Explorer open | Unchanged; never creates Untitled |

**Retarget on Save As success:** replace tab id and buffer key with the new absolute path; set `baselineContent = content`, `dirty = false`, clear `saveError`.

## Desktop: `editor_create_file`

**Input:** `{ projectRoot, path, content }` (camelCase), same shape as write plus create semantics.

| Case | Result |
| ---- | ------ |
| Path under root, missing, parent exists | Create file with `content` |
| Path under root, existing file | Overwrite contents (caller already confirmed) |
| Parent missing | Error (no mkdir) |
| Outside project | `OutsideProject` |
| Path is a directory | Error (not a file) |

`editor_write_file` remains exist-only. Normal path-tab saves continue to use write; Save As always uses create.

## UI

### Tab strip

- Enable `+` (aria/tooltip: “New untitled file”)
- Labels: `Untitled-N` or file basename; dirty indicator and close unchanged
- Optional: “Save As…” action for the active tab (same dialog) — **in scope for 2b**

### Save As dialog

In-app (not native OS dialog, not `window.confirm` for the path form):

- Folder chooser constrained to `projectRoot`
- Filename field (client-validate non-empty; reject empty before Desktop call)
- Primary **Save** / **Cancel**
- If target exists: overwrite confirmation before calling Desktop

### Close / quit Untitled

Reuse three-action pattern; for Untitled, **Save** means Save As.

## Error handling

| Case | Behavior |
| ---- | -------- |
| Create I/O / outside / not a file / missing parent | Keep source tab; set `saveError`; keep Save As dialog open |
| Empty filename | Client validation only; no Desktop call |
| Quit: path save fails | 2a behavior (activate failing path tab, prevent quit) |
| Quit: Untitled Save As fails or Cancel | Activate that Untitled; `saveError` if failed; prevent quit |
| Leave + Untitled Cancel | Untitled stays dirty in memory |

## Testing

- **Store:** `+` allocates `untitled:N`; retarget replaces id; collision closes other open path tab; path `save` still uses write; Untitled never calls write
- **Save As UI:** folder+name; overwrite confirm; validation; failure keeps dialog
- **Triggers:** ⌘S / leave on Untitled open Save As; path tabs unchanged
- **Close / quit:** Untitled Save As / Don’t save / Cancel; quit order path-then-Untitled
- **Desktop:** create new; overwrite; reject outside / missing parent / directory

## Non-goals (2b)

- OS desktop file drops / outside-project tabs (2c)
- Native OS save dialog
- Creating missing parent directories
- Tab persistence, reorder, split panes
- Changing explorer “New File” (separate create flow)

## Module layout (additions / touch points)

```text
src-tauri/src/editor/          # create.rs (or extend write) + register command
src/modules/editor/api/        # createFile
src/modules/editor/state/      # tab ids, nextUntitled, saveAs / retarget
src/modules/editor/ui/         # EditorSaveAsDialog; enable +; save/quit wiring
src/modules/editor/CONTEXT.md  # Untitled, Save As terms
```

## Spec coverage vs roadmap

| Roadmap ask | Where it lands |
| ----------- | -------------- |
| Enabled `+`, Untitled buffers | 2b |
| Save / Save As | Path Save = 2a write; Untitled Save + Save As = 2b |
| Desktop create-under-root | `editor_create_file` |
| OS drops / outside-project | **2c** |
