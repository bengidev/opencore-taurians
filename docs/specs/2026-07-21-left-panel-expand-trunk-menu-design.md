# Left Panel Expand Animation + Trunk Context Menu Design

## Goal

Make project expand/collapse in the left **Projects** panel feel smooth (no hard jump), and move trunk row actions into a right-click context menu with inline rename — matching the explorer’s interaction pattern.

## Decisions

| Topic | Choice |
| --- | --- |
| Expand animation | CSS grid `grid-template-rows: 0fr` ↔ `1fr` (~180ms ease-out); respect `prefers-reduced-motion` |
| Trunk actions UI | Right-click `ContextMenu` (Base UI / shadcn); remove always-visible pin/delete icon buttons on trunk rows |
| Menu items | Rename, Pin/Unpin, Delete |
| Rename UX | Inline in the trunk row (Enter commit, Esc cancel), like explorer |
| Project rows | Unchanged this pass (keep existing icon tools; no project context menu) |

## Expand / collapse

In `ProjectRow` (or a thin wrapper around `ProjectTrunkTree`):

- Keep the trunk list in the DOM while collapsing.
- Outer wrapper uses animated `grid-template-rows` between `0fr` and `1fr`.
- Inner wrapper uses `min-h-0 overflow-hidden`.
- Expanded state still driven by `expandedProjectIds` / search auto-expand rules.
- When `prefers-reduced-motion: reduce`, skip the transition (instant open/close).

Do **not** change which projects auto-expand during search.

## Trunk context menu

Wrap each trunk row (or its primary hit target) with the same context-menu primitives used by the explorer (`ContextMenu` / `ContextMenuTrigger` / `ContextMenuContent` / `ContextMenuItem`).

Items:

1. **Rename** — enter inline rename mode for that trunk
2. **Pin** or **Unpin** — toggle via existing `setTrunkPinned`
3. **Delete** — confirm with existing copy (`Delete this trunk?`), then `deleteTrunkCascade`

Styling: reuse explorer menu chrome (`font-mono text-[11px] tracking-[0.08em]`, compact min-width) or an equivalent shared class on the project module.

Remove `PanelToolButton` pin/delete controls from `TrunkRow` so the row is title-only (+ active highlight).

## Inline rename

### Store

Add to `projectStore`:

- `renameTrunk(trunkId: string, title: string): void`
  - Trim title; ignore empty/whitespace (keep previous title / no-op)
  - Update that trunk’s `title` only

### UI

Local UI state on the trunk tree (e.g. `renamingTrunkId: string | null`):

- Context menu **Rename** sets `renamingTrunkId`
- Row shows a text input (mirror `ExplorerRenameInput` behavior: select-all on focus, Enter commit, Esc/blur cancel)
- On commit: `renameTrunk(id, value)` then clear renaming state
- On cancel: clear renaming state without writing

## Out of scope

- Project-row context menu
- Removing project-row icon tools
- Drag-and-drop changes
- Group rename / delete
- Fuzzy search changes

## Tests

- Store: `renameTrunk` updates title; empty/whitespace no-op
- UI: trunk context menu exposes Rename / Pin|Unpin / Delete; Delete still confirms; Pin toggles
- UI: Rename → inline input → Enter updates title; Esc leaves title unchanged
- UI: expand/collapse still toggles visibility of trunks (animation need not be asserted beyond presence of expanded content)

## Implementation sketch

1. `renameTrunk` + store tests  
2. Smooth expand wrapper on project trunk list  
3. Trunk context menu + inline rename + remove icon buttons + UI tests  
