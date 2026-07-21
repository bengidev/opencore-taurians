# Explorer Loaded-Tree Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Files search field that filters the already-loaded explorer tree by basename while keeping ancestors visible for display only.

**Architecture:** Pure `filterExplorerTree` helper over `childrenByPath`; `searchQuery` in `explorerStore`; `ExplorerPanel` search input (Projects styling); `ExplorerTree` applies filter via a small view context so rows use filtered children and `expandedPaths ∪ displayOpenPaths` without mutating real expand state.

**Tech Stack:** React 19, Zustand, Vitest, existing explorer module.

**Spec:** `docs/specs/2026-07-21-explorer-loaded-tree-search-design.md`

## Global Constraints

- Loaded tree only — no disk walk, no new Rust commands.
- Match: case-insensitive basename substring (`entry.name`).
- While filtering: ancestors of matches stay visible; open state for display only (`displayOpenPaths`), never write filter results into `expandedPaths`.
- Empty/whitespace query → normal tree + real `expandedPaths`.
- Clear `searchQuery` on full `loadRoot` reset (project change / no project); keep on same-project remount early return.
- UI under Files header; mirror Projects search input styling.
- Prefer `bun run test` / targeted Vitest paths.
- Plans/specs live under `docs/plans` and `docs/specs`.

## File structure

| File | Responsibility |
| --- | --- |
| `src/modules/explorer/domain/filterExplorerTree.ts` | Pure filter helper |
| `src/modules/explorer/domain/filterExplorerTree.test.ts` | Unit tests for filter rules |
| `src/modules/explorer/state/explorerStore.ts` | `searchQuery` + `setSearchQuery`; clear on full reset |
| `src/modules/explorer/state/explorerStore.test.ts` | Store search lifecycle tests |
| `src/modules/explorer/ui/ExplorerPanel.tsx` | Search input under Files header |
| `src/modules/explorer/ui/ExplorerTree.tsx` | Apply filter + display-open for rows |
| `src/modules/explorer/ui/ExplorerPanel.test.tsx` | UI filter / clear / expand unchanged |

---

### Task 1: `filterExplorerTree` helper

**Files:**
- Create: `src/modules/explorer/domain/filterExplorerTree.ts`
- Create: `src/modules/explorer/domain/filterExplorerTree.test.ts`

**Interfaces:**
- Consumes: `ExplorerEntry` from `./explorerTypes`
- Produces: `filterExplorerTree({ childrenByPath, rootPath, query }) → { childrenByPath; displayOpenPaths } | null`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/explorer/domain/filterExplorerTree.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterExplorerTree } from "./filterExplorerTree";
import type { ExplorerEntry } from "./explorerTypes";

const root = "/proj";
const src: ExplorerEntry = { name: "src", path: "/proj/src", isDir: true };
const lib: ExplorerEntry = { name: "lib", path: "/proj/lib", isDir: true };
const mainDart: ExplorerEntry = {
  name: "main.dart",
  path: "/proj/src/main.dart",
  isDir: false,
};
const readme: ExplorerEntry = {
  name: "README.md",
  path: "/proj/README.md",
  isDir: false,
};

const childrenByPath: Record<string, ExplorerEntry[]> = {
  [root]: [src, lib, readme],
  "/proj/src": [mainDart],
  "/proj/lib": [{ name: "util.ts", path: "/proj/lib/util.ts", isDir: false }],
};

describe("filterExplorerTree", () => {
  it("returns null for empty or whitespace query", () => {
    expect(
      filterExplorerTree({ childrenByPath, rootPath: root, query: "" }),
    ).toBeNull();
    expect(
      filterExplorerTree({ childrenByPath, rootPath: root, query: "  " }),
    ).toBeNull();
  });

  it("matches basenames case-insensitively", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "READ",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root]).toEqual([readme]);
  });

  it("keeps ancestors of nested matches and marks them display-open", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "main",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root]).toEqual([src]);
    expect(result!.childrenByPath["/proj/src"]).toEqual([mainDart]);
    expect(result!.childrenByPath["/proj/lib"]).toBeUndefined();
    expect(result!.displayOpenPaths.has("/proj/src")).toBe(true);
  });

  it("keeps a matching folder even when it has no matching children", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "lib",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root].map((e) => e.path)).toContain(
      "/proj/lib",
    );
    expect(result!.displayOpenPaths.has("/proj/lib")).toBe(false);
  });

  it("returns empty root children when nothing matches", () => {
    const result = filterExplorerTree({
      childrenByPath,
      rootPath: root,
      query: "zzz-nope",
    });
    expect(result).not.toBeNull();
    expect(result!.childrenByPath[root]).toEqual([]);
    expect(result!.displayOpenPaths.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/modules/explorer/domain/filterExplorerTree.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Write the implementation**

Create `src/modules/explorer/domain/filterExplorerTree.ts`:

```ts
import type { ExplorerEntry } from "./explorerTypes";

export type FilterExplorerTreeResult = {
  childrenByPath: Record<string, ExplorerEntry[]>;
  displayOpenPaths: Set<string>;
};

export function filterExplorerTree(input: {
  childrenByPath: Record<string, ExplorerEntry[]>;
  rootPath: string;
  query: string;
}): FilterExplorerTreeResult | null {
  const trimmed = input.query.trim();
  if (!trimmed) {
    return null;
  }

  const needle = trimmed.toLowerCase();
  const source = input.childrenByPath;
  const filtered: Record<string, ExplorerEntry[]> = {};
  const displayOpenPaths = new Set<string>();

  const matches = (name: string): boolean =>
    name.toLowerCase().includes(needle);

  const filterDir = (dirPath: string): ExplorerEntry[] => {
    const children = source[dirPath] ?? [];
    const kept: ExplorerEntry[] = [];

    for (const entry of children) {
      if (entry.isDir) {
        const childKept = filterDir(entry.path);
        if (matches(entry.name) || childKept.length > 0) {
          kept.push(entry);
          filtered[entry.path] = childKept;
          if (childKept.length > 0) {
            displayOpenPaths.add(entry.path);
          }
        }
      } else if (matches(entry.name)) {
        kept.push(entry);
      }
    }

    return kept;
  };

  filtered[input.rootPath] = filterDir(input.rootPath);
  return { childrenByPath: filtered, displayOpenPaths };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/modules/explorer/domain/filterExplorerTree.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/explorer/domain/filterExplorerTree.ts src/modules/explorer/domain/filterExplorerTree.test.ts
git commit -m "$(cat <<'EOF'
Add pure filter helper for loaded explorer tree search.

EOF
)"
```

---

### Task 2: Store `searchQuery`

**Files:**
- Modify: `src/modules/explorer/state/explorerStore.ts`
- Modify: `src/modules/explorer/state/explorerStore.test.ts`

**Interfaces:**
- Consumes: existing `loadRoot` early-return / full-reset behavior
- Produces: `searchQuery: string`; `setSearchQuery(query: string): void`

- [ ] **Step 1: Write the failing tests**

Append to `src/modules/explorer/state/explorerStore.test.ts` (keep existing tests):

```ts
  it("setSearchQuery updates searchQuery", () => {
    useExplorerStore.getState().setSearchQuery("dart");
    expect(useExplorerStore.getState().searchQuery).toBe("dart");
  });

  it("keeps searchQuery on same-project loadRoot remount", async () => {
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    useExplorerStore.getState().setSearchQuery("a.ts");

    await useExplorerStore.getState().loadRoot();

    expect(useExplorerStore.getState().searchQuery).toBe("a.ts");
  });

  it("clears searchQuery when loadRoot switches projects", async () => {
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/proj-a",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const api = createMemoryExplorerApi({
      dirs: {
        "/proj-a": [{ name: "a.ts", path: "/proj-a/a.ts", isDir: false }],
        "/proj-b": [{ name: "b.ts", path: "/proj-b/b.ts", isDir: false }],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();
    useExplorerStore.getState().setSearchQuery("a.ts");

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/proj-b",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    await useExplorerStore.getState().loadRoot();

    expect(useExplorerStore.getState().searchQuery).toBe("");
    expect(useExplorerStore.getState().projectRoot).toBe("/proj-b");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/modules/explorer/state/explorerStore.test.ts`

Expected: FAIL (`setSearchQuery` / `searchQuery` missing, or search not cleared on project switch)

- [ ] **Step 3: Implement store fields**

In `src/modules/explorer/state/explorerStore.ts`:

1. Add to `createEmptyState()`:

```ts
    searchQuery: "",
```

2. Add to `ExplorerState`:

```ts
  searchQuery: string;
  setSearchQuery: (query: string) => void;
```

3. In the full-reset branch of `loadRoot` (the `set({ projectRoot, childrenByPath: {}, ...})` call), also set:

```ts
      searchQuery: "",
```

(Do **not** clear `searchQuery` in the same-project early-return path.)

4. In the store return object, add:

```ts
    setSearchQuery: (query) => set({ searchQuery: query }),
```

Note: `createEmptyState()` already feeds `resetExplorerState` and the no-project `loadRoot` path, so those clear search automatically once `searchQuery: ""` is in empty state.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/modules/explorer/state/explorerStore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/explorer/state/explorerStore.ts src/modules/explorer/state/explorerStore.test.ts
git commit -m "$(cat <<'EOF'
Add explorer searchQuery state with project-switch reset.

EOF
)"
```

---

### Task 3: Wire search UI into ExplorerPanel + ExplorerTree

**Files:**
- Modify: `src/modules/explorer/ui/ExplorerPanel.tsx`
- Modify: `src/modules/explorer/ui/ExplorerTree.tsx`
- Modify: `src/modules/explorer/ui/ExplorerPanel.test.tsx`

**Interfaces:**
- Consumes: `filterExplorerTree` from `../domain/filterExplorerTree`; `searchQuery` / `setSearchQuery` from store
- Produces: search input under Files; filtered tree rendering + “No matching files” empty state

- [ ] **Step 1: Write the failing UI tests**

Append to `src/modules/explorer/ui/ExplorerPanel.test.tsx`:

```ts
  it("filters the loaded tree by basename and keeps ancestors visible", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";
    const subDir = "/proj/src";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [
          { name: "src", path: subDir, isDir: true },
          { name: "README.md", path: "/proj/README.md", isDir: false },
        ],
        [subDir]: [
          { name: "main.dart", path: "/proj/src/main.dart", isDir: false },
        ],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    await user.click(await screen.findByRole("button", { name: "src" }));
    expect(await screen.findByText("main.dart")).toBeInTheDocument();

    const expandedBefore = new Set(useExplorerStore.getState().expandedPaths);
    await user.type(screen.getByRole("searchbox", { name: "Search files" }), "main");

    expect(screen.getByText("main.dart")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.queryByText("README.md")).not.toBeInTheDocument();

    const expandedAfter = useExplorerStore.getState().expandedPaths;
    expect([...expandedAfter].sort()).toEqual([...expandedBefore].sort());
  });

  it("clears the filter and restores the full loaded tree", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [
          { name: "a.ts", path: "/proj/a.ts", isDir: false },
          { name: "b.ts", path: "/proj/b.ts", isDir: false },
        ],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    expect(await screen.findByText("a.ts")).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: "Search files" });
    await user.type(search, "a.ts");
    expect(screen.queryByText("b.ts")).not.toBeInTheDocument();

    await user.clear(search);
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
  });

  it("shows no-matching hint when the filter matches nothing", async () => {
    const user = userEvent.setup();
    const folderPath = "/proj";

    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [{ name: "a.ts", path: "/proj/a.ts", isDir: false }],
      },
    });

    render(<ExplorerPanel explorerApi={api} />);
    expect(await screen.findByText("a.ts")).toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: "Search files" }),
      "zzz",
    );
    expect(screen.getByText(/no matching files/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/modules/explorer/ui/ExplorerPanel.test.tsx`

Expected: FAIL (no searchbox / filter behavior)

- [ ] **Step 3: Add the search input to ExplorerPanel**

In `src/modules/explorer/ui/ExplorerPanel.tsx`:

1. Read store:

```ts
  const searchQuery = useExplorerStore((s) => s.searchQuery);
  const setSearchQuery = useExplorerStore((s) => s.setSearchQuery);
```

2. Immediately after the `</header>` that contains “Files”, when `project` is set, add:

```tsx
      {project ? (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <input
            type="search"
            aria-label="Search files"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            className="w-full border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      ) : null}
```

Do not change the scroll area / context menu structure beyond this insertion.

- [ ] **Step 4: Wire ExplorerTree to the filter**

In `src/modules/explorer/ui/ExplorerTree.tsx`, keep Material icons, rename, openFile, and styles. Apply these changes:

1. Add imports:

```ts
import { createContext, useContext, useMemo } from "react";
import { filterExplorerTree } from "../domain/filterExplorerTree";
```

2. Add a view context above `ExplorerEntryRow`:

```ts
type ExplorerTreeView = {
  childrenByPath: Record<string, ExplorerEntry[]>;
  isExpanded: (path: string) => boolean;
};

const ExplorerTreeViewContext = createContext<ExplorerTreeView | null>(null);

function useExplorerTreeView(): ExplorerTreeView {
  const value = useContext(ExplorerTreeViewContext);
  if (!value) {
    throw new Error("ExplorerEntryRow must render inside ExplorerTree");
  }
  return value;
}
```

3. In `ExplorerEntryRow`, use the context for display children/expansion (keep selection, rename, loading, toggle, select from store):

```ts
  const treeView = useExplorerTreeView();
  const selectedPath = useExplorerStore((s) => s.selectedPath);
  const renamingPath = useExplorerStore((s) => s.renamingPath);
  const loadingPaths = useExplorerStore((s) => s.loadingPaths);
  const toggleExpanded = useExplorerStore((s) => s.toggleExpanded);
  const selectPath = useExplorerStore((s) => s.selectPath);

  const expanded = treeView.isExpanded(entry.path);
  const children = treeView.childrenByPath[entry.path] ?? [];
```

Remove the row’s direct `expandedPaths` / `childrenByPath` store subscriptions used only for display.

4. Replace `ExplorerTree` body with:

```ts
export function ExplorerTree() {
  const projectRoot = useExplorerStore((s) => s.projectRoot);
  const childrenByPath = useExplorerStore((s) => s.childrenByPath);
  const expandedPaths = useExplorerStore((s) => s.expandedPaths);
  const loadingPaths = useExplorerStore((s) => s.loadingPaths);
  const searchQuery = useExplorerStore((s) => s.searchQuery);

  const treeView = useMemo<ExplorerTreeView | null>(() => {
    if (!projectRoot) {
      return null;
    }
    const filtered = filterExplorerTree({
      childrenByPath,
      rootPath: projectRoot,
      query: searchQuery,
    });
    if (!filtered) {
      return {
        childrenByPath,
        isExpanded: (path) => expandedPaths.has(path),
      };
    }
    return {
      childrenByPath: filtered.childrenByPath,
      isExpanded: (path) =>
        expandedPaths.has(path) || filtered.displayOpenPaths.has(path),
    };
  }, [projectRoot, childrenByPath, expandedPaths, searchQuery]);

  if (!projectRoot || !treeView) {
    return null;
  }

  const rootChildren = treeView.childrenByPath[projectRoot] ?? [];
  const isLoadingRoot = loadingPaths.has(projectRoot);
  const isFiltering = searchQuery.trim().length > 0;

  if (rootChildren.length === 0 && !isLoadingRoot) {
    return (
      <p className="px-3 py-6 text-center font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
        {isFiltering ? "No matching files." : "This folder is empty."}
        {!isFiltering ? (
          <span className="mt-1 block text-[10px] text-muted-foreground/70">
            Right-click to create a file or folder.
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <ExplorerTreeViewContext.Provider value={treeView}>
      <ul aria-label="explorer tree" className="list-none py-0.5">
        {rootChildren.map((entry) => (
          <ExplorerEntryRow key={entry.path} entry={entry} depth={0} />
        ))}
      </ul>
    </ExplorerTreeViewContext.Provider>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
bun run test \
  src/modules/explorer/domain/filterExplorerTree.test.ts \
  src/modules/explorer/state/explorerStore.test.ts \
  src/modules/explorer/ui/ExplorerPanel.test.tsx \
  src/modules/explorer/ui/ExplorerTree.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add \
  src/modules/explorer/ui/ExplorerPanel.tsx \
  src/modules/explorer/ui/ExplorerTree.tsx \
  src/modules/explorer/ui/ExplorerPanel.test.tsx
git commit -m "$(cat <<'EOF'
Show loaded-tree search under explorer Files header.

EOF
)"
```

---

## Self-review checklist (author)

- Spec coverage: search UI, basename filter, ancestor display-open, store lifecycle, empty hint, no `expandedPaths` mutation, tests — Tasks 1–3.
- No placeholders left in steps.
- `filterExplorerTree` / `searchQuery` / `setSearchQuery` names consistent across tasks.
- Out of scope left out: disk walk, fuzzy/regex, mutating expand state, command palette.
