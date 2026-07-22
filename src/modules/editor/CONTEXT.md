# Editor

Monaco-based editing for project files opened from the explorer. Phase 1: single buffer, read/write via Desktop commands, auto-save on card switch and file switch.

## Language

**Editor**:
The editor module and its behavior: opening and editing project files in the **Editor** main card, dirty tracking, manual save (⌘/Ctrl+S), and auto-save when leaving the card, quitting, or opening another file. File I/O goes through `editor_read_file` / `editor_write_file`; no direct filesystem access from React.
_Avoid_: Code editor (when referring to the module), Monaco (when referring to the whole feature)

**Editor Buffer**:
The single open file's in-memory state in Phase 1 — `path`, `content`, `baselineContent`, `dirty`, and save/load status (`idle` / `loading` / `ready` / `saving` / `error`). Only one buffer at a time; opening another file saves the current buffer first when dirty.
_Avoid_: Tab, document model, open files list (Phase 1 has no multi-tab buffer set)

**Editor Panel**:
The UI host mounted in the **Editor** main card — renders empty, loading, error, save-error, or lazy-loaded Monaco based on `editorStore` state. Wired to save triggers and the Tauri `editorApi`.
_Avoid_: Main card (when referring to the whole shell region), Monaco host (when referring to the panel shell)
