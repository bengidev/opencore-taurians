# Editor

Monaco-based editing for project files opened from the explorer. Phase 2a: multiple path-keyed tabs inside the **Editor** main card, read/write via Desktop commands, manual save on the active tab, and quit saves all dirty tabs.

## Language

**Editor**:
The editor module and its behavior: opening and editing project files in the **Editor** main card, dirty tracking per tab, manual save (⌘/Ctrl+S) on the active tab only, auto-save when leaving the card or quitting, and opening or focusing tabs without save-before-switch. File I/O goes through `editor_read_file` / `editor_write_file`; no direct filesystem access from React.
_Avoid_: Code editor (when referring to the module), Monaco (when referring to the whole feature), calling the Editor main card a “tab”

**Editor Tab**:
An open file in the editor’s path-keyed tab set — `tabs` holds `{ path }` entries; `activePath` is the focused tab. Opening an already-open path focuses it; a new path appends a tab and loads its buffer. The tab strip (`+` disabled until Phase 2b) is UI chrome inside the Editor card, not a shell main card.
_Avoid_: Untitled (Phase 2b), OS desktop file drops (Phase 2c), tab (when meaning the Editor main card)

**Editor Buffer**:
Per-tab in-memory state keyed by path in `buffers` — `content`, `baselineContent`, `dirty`, and save/load status (`idle` / `loading` / `ready` / `saving` / `error`). Each open tab has its own buffer; switching tabs does not save other dirty buffers.
_Avoid_: Single buffer, save-before-open-other (Phase 1), document model (when a plain “buffer” suffices)

**Editor Panel**:
The UI host mounted in the **Editor** main card — renders the tab strip, empty/loading/error/save-error states, or lazy-loaded Monaco for the active buffer based on `editorStore`. Wired to save triggers (active tab only for leave-card and ⌘/Ctrl+S) and the Tauri `editorApi`.
_Avoid_: Main card (when referring to the whole shell region), Monaco host (when referring to the panel shell)
