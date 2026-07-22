# Editor

Monaco-based editing for project files opened from the explorer. Phase 2a: multiple path-keyed tabs inside the **Editor** main card, read/write via Desktop commands, manual save on the active tab, and quit saves all dirty tabs. Phase 2b: Untitled buffers via enabled `+`, Save As to materialize or retarget files under `projectRoot`.

## Language

**Editor**:
The editor module and its behavior: opening and editing project files in the **Editor** main card, dirty tracking per tab, manual save (⌘/Ctrl+S) on the active tab only, auto-save when leaving the card or quitting, and opening or focusing tabs without save-before-switch. File I/O goes through `editor_read_file` / `editor_write_file` / `editor_create_file`; no direct filesystem access from React.
_Avoid_: Code editor (when referring to the module), Monaco (when referring to the whole feature), calling the Editor main card a “tab”

**Editor Tab**:
An open file or Untitled buffer in the editor’s id-keyed tab set — `tabs` holds `{ id }` entries where `id` is `untitled:N` or an absolute path; `activeTabId` is the focused tab. Opening an already-open path focuses it; a new path or Untitled appends a tab and loads or creates its buffer. The tab strip (`+` opens Untitled when a project is open; per-tab context menu for Save, Save As, and Close) is UI chrome inside the Editor card, not a shell main card.
_Avoid_: tab (when meaning the Editor main card)

**Untitled**:
An in-memory editor tab with id `untitled:N` — no disk path until Save As succeeds. Opened via the tab strip `+`; label shown as `Untitled-N`. Never writes via normal save; materialized through Save As (`editor_create_file`).
_Avoid_: Calling Untitled tabs “new files” before Save As, treating `untitled:N` as a filesystem path

**Save As**:
In-app flow (folder under `projectRoot` + filename) that calls `editor_create_file` and retargets the source tab to the new absolute path. Available from each editor tab’s context menu; also triggered for Untitled on ⌘S, leave, close, and quit. Path-backed tabs can Save As to retarget to a different path.
_Avoid_: Using `editor_write_file` for Save As (create-only), silent disk writes for Untitled

**Editor Buffer**:
Per-tab in-memory state keyed by tab id in `buffers` — `content`, `baselineContent`, `dirty`, and save/load status (`idle` / `loading` / `ready` / `saving` / `error`). Each open tab has its own buffer; switching tabs does not save other dirty buffers.
_Avoid_: Single buffer, save-before-open-other (Phase 1), document model (when a plain “buffer” suffices)

**Editor Panel**:
The UI host mounted in the **Editor** main card — renders the tab strip, empty/loading/error/save-error states, or lazy-loaded Monaco for the active buffer based on `editorStore`. Wired to save triggers (active tab only for leave-card and ⌘/Ctrl+S) and the Tauri `editorApi`.
_Avoid_: Main card (when referring to the whole shell region), Monaco host (when referring to the panel shell)

**External / Read-only tab**:
Absolute path outside `projectRoot`, opened via OS drop or Open…; `readOnly` buffer; view-only Monaco; Save/Save As disabled.
_Avoid_: treating external paths as project files, writing them with `editor_write_file`
