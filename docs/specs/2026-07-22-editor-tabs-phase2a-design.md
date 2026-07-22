# Editor Tabs — Phase 2a design

Date: 2026-07-22  
Status: Approved for implementation planning  
Scope: **Phase 2a only** (multi-tab strip for project files). Phases 2b and 2c are roadmap slices, not implemented here.

Related: Phase 1 — `docs/superpowers/specs/2026-07-22-editor-monaco-phase1-design.md` (single buffer). Master roadmap Phase 2 was “Tabs & dirty UI”; this document deep-designs the first shippable slice of that phase.

## Goal

Replace the Editor main card’s plain `EDITOR` label with a VS Code–style **tab strip**. Users can keep multiple **project** files open, switch by clicking tabs, open via Explorer click or drag onto the strip, see dirty indicators, and close tabs with a Save / Don’t save / Cancel prompt.

## Decisions (locked)

| Topic | Choice |
| ----- | ------ |
| Delivery | Layered Phase 2: **2a → 2b → 2c** (not one monolithic ship) |
| Tab model | True multi-file open set (not single-buffer chrome) |
| Open source (2a) | Explorer click + Explorer drag-and-drop onto tab strip |
| `+` control (2a) | Visible but **disabled** (layout matches end state; behavior in 2b) |
| Dirty close | In-app dialog: **Save** / **Don’t save** / **Cancel** |
| Save-on-open-other | **Removed** for Phase 2a — opening another file appends/focuses a tab; dirty buffers stay until closed or saved |
| Save policy | ⌘/Ctrl+S and leave-card: **active** tab only. Quit: save **all** dirty tabs (block quit if any fail). |
| Desktop I/O (2a) | Unchanged: `editor_read_file` / `editor_write_file`, project-scoped |

## Roadmap (deferred)

| Slice | Ships | Not in 2a |
| ----- | ----- | --------- |
| **2a** | Tab strip, multi-buffer store, Explorer open/DnD, dirty dots, close prompt, disabled `+` | — |
| **2b** | Enabled `+`, Untitled buffers, Save / Save As, Desktop create-under-root | Untitled ids, create-new write |
| **2c** | OS (Finder/Explorer) file drops; outside-project **read-only** open | External read path; write disabled for those tabs |

## Architecture

| Layer | Location | Responsibility |
| ----- | -------- | -------------- |
| Desktop | `src-tauri/src/editor/` | No new commands in 2a |
| API | `src/modules/editor/api/` | Unchanged invoke wrappers |
| State | `editorStore` | Open tab set + per-tab buffers + active path |
| UI | `EditorTabStrip`, close dialog, `EditorPanel` | Strip replaces card label; body still empty/loading/error/Monaco for **active** tab |
| Explorer | `ExplorerTree` (+ DnD payload) | Click/drag → `openFile` (append or focus) |
| Shell | `shellMainPanel` | Editor card hosts strip + panel; Chat/Terminal keep simple labels |

**Boundaries**

- Still Rust-first: no `@tauri-apps/plugin-fs` in `src/modules/*`.
- Monaco stays UI-only; never reads/writes disk.
- Phase 2a tabs are project-scoped paths only.
- Domain language: shell **main cards** vs file **tabs** (do not call the Editor card a “tab”).

## Tab / buffer model

**Identity:** Each tab is keyed by absolute file `path` under `projectRoot` (no Untitled keys in 2a).

**Conceptual store shape**

```text
tabs: { path: string }[]          // open order, left → right
activePath: string | null
buffers: Record<path, {
  content: string
  baselineContent: string
  dirty: boolean
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'error'
  errorMessage: string | null
  saveError: string | null
}>
projectRoot: string | null
api: EditorApi | null
```

Exact TypeScript field names may follow existing store style; semantics above are required.

### Behaviors

| Action | Result |
| ------ | ------ |
| Open path already in `tabs` | Focus that tab; clear stale `saveError`. Do not reload unless that buffer’s `status` is `error` (then retry load). |
| Open new path | Append tab, set `activePath`, load into that buffer (`loading` → `ready` or `error`). |
| Edit | Updates **active** buffer only; `dirty === content !== baselineContent` per tab. |
| Save / saveIfDirty | **Active** tab only for manual ⌘/Ctrl+S (same success/failure semantics as Phase 1). |
| Leave Editor card | Auto-save **active** dirty tab only (Phase 1 leave policy). Other dirty tabs stay dirty in memory (cards remain mounted). |
| App / window quit | Attempt to save **all** dirty tabs (in open order). If any save fails, **prevent quit** when the platform allows and surface error on the failing tab (activate it). Success on all → allow quit. |
| Close tab (clean) | Remove tab; if it was active, activate neighbor (prefer right, else left); if none left, `activePath = null` → empty state. |
| Close tab (dirty) | Show dialog. **Save** → save that tab then close on success; on failure keep tab + dialog + `saveError`. **Don’t save** → discard buffer and close. **Cancel** → keep tab. |
| Explorer DnD onto strip | Same as open (append or focus). |
| Disabled `+` | No-op. |

## UI

### Tab strip

Replaces the uppercase `EDITOR` label in the Editor main card header.

- File tab: basename, dirty indicator (`•` or equivalent), close control (`×`)
- Active tab visually selected
- Trailing **disabled** `+` (affordance only; optional short tooltip that Untitled comes later)
- Strip is the **drop target** for Explorer file drags (drag-over highlight)

### Body

Phase 1 empty / loading / error / Monaco + inline `saveError`, driven by the **active** tab’s buffer. No path / no tabs → “Open a file from the explorer”.

### Close confirmation

In-app dialog (not `window.confirm` — needs three actions):

- Title/body: ask whether to save changes to `{basename}`
- Actions: **Save** / **Don’t save** / **Cancel**

### Explorer

- Click file → switch to Editor main card + open/focus tab
- Drag file from tree → drop on tab strip → same open/focus
- Folder drops: ignore / no-op

## Error handling

| Case | Behavior |
| ---- | -------- |
| Load failure | That tab remains open with `status: error` and `errorMessage`; no Monaco for that tab; other tabs unaffected |
| Save failure (⌘S / leave) | Keep dirty; set `saveError` on active buffer; leave-card still leaves |
| Save failure (quit, any dirty tab) | Keep that tab dirty; activate the failing tab; set its `saveError`; prevent quit when preventable |
| Close → Save fails | Tab stays open; dialog stays open (or re-shows); `saveError` set |
| Path outside project / binary / oversize | Existing Desktop rejection → load error on that tab |
| Drop non-file | No-op |

## Testing

- **Store:** append vs focus; per-tab dirty; close Save / Don’t save / Cancel; neighbor activation; ⌘S / leave-card touch active only; quit saves all dirty tabs; open does not force-save other dirty tabs
- **Tab strip:** basenames + dirty; disabled `+`; drop invokes open
- **Close dialog:** three actions and Save-failure keeps tab
- **Explorer:** click opens Editor card + tab (update Phase 1 tests that assumed single-buffer replace)

## Non-goals (2a)

- Untitled / `+` creating buffers
- Save As / create new file from editor
- OS desktop file drops
- Outside-project read-only editing
- Tab persistence across relaunch
- Tab reorder by drag (optional later; not required for 2a)
- Split panes, find/replace, minimap (later roadmap phases)

## Module layout (additions)

```text
src/modules/editor/
  state/editorStore.ts          # multi-tab model
  ui/EditorTabStrip.tsx
  ui/EditorCloseTabDialog.tsx   # or equivalent name
  ui/EditorPanel.tsx            # active buffer host
  CONTEXT.md                    # update terms: Editor Tab, multi-buffer

src/modules/explorer/ui/…       # DnD source + open/focus wiring
src/modules/shell/ui/panels/shellMainPanel.tsx  # strip in editor card header
```

## Spec coverage vs user request

| User ask | Where it lands |
| -------- | -------------- |
| Tab style header; first tab = open file | 2a |
| `+` with undefined / Untitled name | **2b** (disabled `+` placeholder in 2a) |
| Drag from panel into tab section | Explorer DnD in **2a**; OS DnD in **2c** |
| Outside-project read-only | **2c** |
| Dirty close prompt | 2a |
