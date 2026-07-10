# Project

Workspace-scoped projects, nested chunks, manual and auto groups, left-panel navigation, activation, and retention.

## Language

**Project**:
A persisted workspace folder — name, path, pin state, list order, and optional manual group membership. Opening a folder creates or activates its project.
_Avoid_: Workspace (when referring to this entity specifically), repo, root folder

**ProjectChunk**:
A unit of work inside a project — title, pin state, parent/child tree position, and restore snapshot (active main card). Messages and UI state are scoped to the active chunk.
_Avoid_: Session, tab, thread, conversation (when referring to this entity)

**ProjectGroup**:
A labeled bucket that orders projects in the left panel — either manual (user-defined) or auto (derived from folder path segments).
_Avoid_: Folder group, workspace set, collection

**Left Panel navigator**:
The project module UI in the shell left panel — project list, groups, chunk tree, search, and open/switch/relink actions.
_Avoid_: Sidebar, file tree, explorer (when referring to this navigator specifically)

**Retention Sweep**:
Boot-time cleanup that removes unpinned projects and chunks whose `lastOpenedAt` exceeds the retention window. Pinned projects or chunks block eviction of their subtree.
_Avoid_: Garbage collection, prune, cache clear

**Activation**:
Selecting a project or chunk — updates active IDs, touches `lastOpenedAt`, sets the workspace path, and restores the chunk's main card (chat / terminal / editor).
_Avoid_: Focus, select, switch workspace (when referring to this flow specifically)
