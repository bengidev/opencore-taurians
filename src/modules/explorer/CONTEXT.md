# Explorer

Right-panel file tree for the active project — browse folders, open files in the editor, and manage project files on disk.

## Language

**Explorer**:
The explorer module and its behavior: listing the active project's directory tree, opening files in the editor, inline create/rename, context-menu actions, external drop copy, and auto-refresh. Auto-refresh defaults to **live** updates (shell store); **on-activate** refreshes when the active project changes. Scoped to the active project's root path; shows an empty state when no project is selected.
_Avoid_: File tree (when referring to the left panel), sidebar, navigator, project list

**Explorer Panel**:
The UI shell mounted in the shell **Right Panel** — wires the explorer store to Tauri, handles `explorer://changed` and `explorer://drop` events, and renders the tree or empty state.
_Avoid_: Right panel (when referring to the whole shell region), sidebar, inspector

**Explorer Tree**:
The expandable directory tree inside **Explorer Panel** — folder rows, file rows, selection, inline rename, and context menu. Files open in the editor main card.
_Avoid_: File tree (when referring to the left panel), navigator, project tree
