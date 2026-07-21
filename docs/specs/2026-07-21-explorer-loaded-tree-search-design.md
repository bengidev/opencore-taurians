# Explorer Loaded-Tree Search Design

## Goal

Add a search field under the **Files** header in the right-panel explorer that filters the **already loaded** tree by basename, keeping ancestor folders visible (VS Code–style), without walking the disk or mutating real expand state.

## Decisions

| Topic | Choice |
| --- | --- |
| Search depth | Loaded tree only (opened folders’ cached children) |
| Match | Case-insensitive substring on **basename** |
| Tree while filtering | Keep ancestors of matches visible; show them open for display only |
| State | `searchQuery` in `explorerStore`; display-open set derived, not written to `expandedPaths` |
| UI pattern | Same search input look as Projects panel search |

## Placement & UX

In `ExplorerPanel`, directly under the Files header block:

- `<input type="search" aria-label="Search files" placeholder="Search" />`
- Styling mirrors Projects search: full-width bordered mono input in a `border-b` row
- Show the search row when a project is active; omit it (or leave unused) for the empty “select a project” state

Behavior:

- Empty / whitespace-only query → normal tree using real `expandedPaths`
- Non-empty query → filtered tree; ancestors of matches render open for display only
- No matches → small empty hint in the tree area (e.g. “No matching files”), not the error banner
- Context menu, rename, selection, icons, and scroll behavior unchanged

## Data model

Add to `explorerStore`:

- `searchQuery: string` (default `""`)
- `setSearchQuery(query: string)`

Lifecycle:

- **Clear** `searchQuery` on full `loadRoot` reset (active project change / no project)
- **Keep** `searchQuery` on same-project remount (hide/show right panel), consistent with expansion persistence
- Do **not** persist search to disk beyond the in-memory store (session-lived with the store)

## Filter algorithm

Pure helper (e.g. `src/modules/explorer/domain/filterExplorerTree.ts`):

```ts
filterExplorerTree(input: {
  childrenByPath: Record<string, ExplorerEntry[]>;
  rootPath: string;
  query: string;
}): {
  childrenByPath: Record<string, ExplorerEntry[]>;
  displayOpenPaths: Set<string>;
} | null
```

- Trim `query`. If empty after trim, return `null` (caller uses unfiltered tree + real expansion).
- Basename match: `entry.name.toLowerCase().includes(query.toLowerCase())`.
- Keep an entry if it matches **or** (dir and has at least one kept descendant among **already loaded** children in `childrenByPath`).
- Unloaded directories contribute no descendants (cannot surface matches from never-opened folders).
- `displayOpenPaths`: every ancestor path (from root to parent) of each kept entry that must stay visible; matching dirs may be included when they have kept children. Used only for render: `expandedForDisplay = expandedPaths ∪ displayOpenPaths` while filtering.

## Rendering

- `ExplorerTree` (and rows as needed) read `searchQuery` from the store.
- When filter result is non-null, render from filtered `childrenByPath` and `expandedForDisplay`.
- When filter is null, existing expand/collapse behavior only.
- Clearing the query instantly restores the prior expand/collapse view; `expandedPaths` is untouched by the filter.

## Tests

- Unit (`filterExplorerTree`): basename match; nested match keeps ancestors; empty query → `null`/passthrough; no matches → empty children under root; case-insensitive.
- Store: `setSearchQuery`; cleared on project-changing `loadRoot`; retained on same-project `loadRoot` early return.
- UI: typing filters visible rows; clear restores full loaded tree; expand state unchanged by filtering.

## Out of scope

- Whole-project / recursive disk search (Rust walk)
- Fuzzy ranking, regex, gitignore-aware search
- Mutating `expandedPaths` while filtering
- Global “Go to file” command palette

## Implementation sketch

1. Domain helper + unit tests  
2. Store `searchQuery` / `setSearchQuery` + loadRoot clear rules + tests  
3. Panel search input + tree wiring + UI tests  
