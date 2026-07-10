# Workspace Popup

Modal shown when the app needs a workspace before entering the shell. Blocks the shell until a project folder is opened.

## Language

**Workspace Popup**:
The centered modal overlay with welcome copy, get-started actions, and recent-projects placeholder. Shown when no workspace path is set.
_Avoid_: Welcome screen, home modal, launcher (when referring to this picker specifically)

**Open Project**:
The enabled get-started action that opens the native folder picker, then persists the chosen path via `setWorkspace`.
_Avoid_: Open folder, browse, import project (when referring to this action)

**Folder Picker**:
Infrastructure port (`FolderPicker.pickFolder`) abstracting the native directory dialog. Production uses the Tauri dialog plugin; tests inject `createMemoryFolderPicker`.
_Avoid_: File dialog, directory browser, OS picker (when referring to this port)
