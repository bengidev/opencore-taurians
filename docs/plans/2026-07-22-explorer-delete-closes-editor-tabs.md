# Explorer Delete Closes Editor Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explorer Delete confirms with `window.confirm`, warns when matching editor tabs are open, then after successful trash closes those tabs (including cascade under a deleted folder), discarding unsaved changes without a Save / Don’t Save prompt.

**Architecture:** Keep delete UX in Explorer (Approach A). Extract tiny pure helpers for “which tab ids match this delete path” and “confirm message” so matching/copy are unit-tested. `handleDelete` confirms → `trash` → `refresh` → `closeTab` for each match; on trash failure, set explorer error and leave tabs alone.

**Tech Stack:** React 19, Zustand, Vitest, Testing Library, Bun tests.

**Spec:** `docs/specs/2026-07-22-explorer-delete-closes-editor-tabs-design.md`

## Global Constraints

- Confirm **before** trash via `window.confirm` (same pattern as trunk delete).
- Copy with no matching tabs: `Move "{name}" to Trash?`
- Copy with matching tabs: `Move "{name}" to Trash?\n\n{N} open editor tab(s) will close. Unsaved changes will be discarded.`
- File match: tab `id ===` deleted path.
- Folder match: tab `id ===` folder path **or** `id.startsWith(folderPath + "/")`.
- After OK: `trash` → explorer `refresh` → `closeTab` each match (no Save / Don’t Save).
- Trash failure → explorer error; **do not** close tabs.
- Untitled / unrelated tabs untouched.
- Package manager / tests: **Bun** — `bunx vitest run …`.
- Domain language: shell **main cards** ≠ file **tabs**.
- No `@tauri-apps/plugin-fs` in `src/modules/*`.
- Out of scope: OS deletes outside Explorer, rename/move sync, AlertDialog, FS watchers.

---

## File structure

| Path | Role |
| ---- | ---- |
| `src/modules/explorer/domain/explorerDeleteEditorTabs.ts` | `matchingEditorTabIdsForDelete`, `explorerDeleteConfirmMessage` |
| `src/modules/explorer/domain/explorerDeleteEditorTabs.test.ts` | Helper unit tests |
| `src/modules/explorer/ui/ExplorerContextMenu.tsx` | Confirm + close tabs in `handleDelete` |
| `src/modules/explorer/ui/ExplorerPanel.test.tsx` | Confirm cancel/OK, dirty close, folder cascade, trash failure |

---

### Task 1: Matching + confirm message helpers

**Files:**
- Create: `src/modules/explorer/domain/explorerDeleteEditorTabs.ts`
- Create: `src/modules/explorer/domain/explorerDeleteEditorTabs.test.ts`

**Interfaces:**
- Consumes: tab id strings; display `name`; whether deleted path is a directory
- Produces:
  - `matchingEditorTabIdsForDelete(tabIds: readonly string[], deletedPath: string, isDir: boolean): string[]`
  - `explorerDeleteConfirmMessage(name: string, matchingTabCount: number): string`

- [ ] **Step 1: Write failing tests**

Create `explorerDeleteEditorTabs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  explorerDeleteConfirmMessage,
  matchingEditorTabIdsForDelete,
} from "./explorerDeleteEditorTabs";

describe("matchingEditorTabIdsForDelete", () => {
  it("matches exact file path only", () => {
    expect(
      matchingEditorTabIdsForDelete(
        ["/proj/a.ts", "/proj/b.ts", "untitled:1"],
        "/proj/a.ts",
        false,
      ),
    ).toEqual(["/proj/a.ts"]);
  });

  it("cascades under deleted folder", () => {
    expect(
      matchingEditorTabIdsForDelete(
        ["/proj/src/a.ts", "/proj/src", "/proj/other.ts", "untitled:1"],
        "/proj/src",
        true,
      ),
    ).toEqual(["/proj/src/a.ts", "/proj/src"]);
  });

  it("does not treat sibling prefix paths as under a folder", () => {
    expect(
      matchingEditorTabIdsForDelete(
        ["/proj/src2/a.ts", "/proj/src/a.ts"],
        "/proj/src",
        true,
      ),
    ).toEqual(["/proj/src/a.ts"]);
  });
});

describe("explorerDeleteConfirmMessage", () => {
  it("omits tab warning when count is 0", () => {
    expect(explorerDeleteConfirmMessage("a.ts", 0)).toBe('Move "a.ts" to Trash?');
  });

  it("includes tab warning when count > 0", () => {
    expect(explorerDeleteConfirmMessage("src", 2)).toBe(
      'Move "src" to Trash?\n\n2 open editor tab(s) will close. Unsaved changes will be discarded.',
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/explorer/domain/explorerDeleteEditorTabs.test.ts`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement helpers**

Create `explorerDeleteEditorTabs.ts`:

```ts
export function matchingEditorTabIdsForDelete(
  tabIds: readonly string[],
  deletedPath: string,
  isDir: boolean,
): string[] {
  if (!isDir) {
    return tabIds.filter((id) => id === deletedPath);
  }
  const prefix = `${deletedPath}/`;
  return tabIds.filter((id) => id === deletedPath || id.startsWith(prefix));
}

export function explorerDeleteConfirmMessage(
  name: string,
  matchingTabCount: number,
): string {
  const base = `Move "${name}" to Trash?`;
  if (matchingTabCount <= 0) {
    return base;
  }
  return `${base}\n\n${matchingTabCount} open editor tab(s) will close. Unsaved changes will be discarded.`;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bunx vitest run src/modules/explorer/domain/explorerDeleteEditorTabs.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/explorer/domain/explorerDeleteEditorTabs.ts \
  src/modules/explorer/domain/explorerDeleteEditorTabs.test.ts
git commit -m "$(cat <<'EOF'
Add helpers for Explorer delete confirm and matching editor tabs.

EOF
)"
```

---

### Task 2: Wire confirm + close tabs in Explorer Delete

**Files:**
- Modify: `src/modules/explorer/ui/ExplorerContextMenu.tsx`
- Modify: `src/modules/explorer/ui/ExplorerPanel.test.tsx`

**Interfaces:**
- Consumes: `matchingEditorTabIdsForDelete`, `explorerDeleteConfirmMessage`, `useEditorStore.getState().tabs` / `closeTab`, existing `findEntry` / basename for display name and `isDir`
- Produces: `handleDelete` confirms, trashes, refreshes, then closes matching tabs; cancel and trash failure leave tabs alone

- [ ] **Step 1: Update / add failing ExplorerPanel tests**

In `ExplorerPanel.test.tsx`:

1. Import `createMemoryEditorApi` from `../../editor/api/createMemoryEditorApi` and `useEditorStore` from `../../editor/state/editorStore`.
2. In `beforeEach`, also reset the editor store (same shape other explorer/editor tests use):

```ts
useEditorStore.setState({
  api: null,
  projectRoot: null,
  tabs: [],
  activeTabId: null,
  buffers: {},
  nextUntitled: 1,
  openBatchError: null,
});
```

3. Change the existing `context menu Delete removes the file` test to stub confirm → `true`:

```ts
vi.spyOn(window, "confirm").mockReturnValue(true);
```

(Restore via existing `vi` / `afterEach` — add `vi.restoreAllMocks()` in `afterEach` if not already present.)

4. Add these tests (adjust setup to match existing project/explorer patterns in the same file):

```ts
it("context menu Delete cancel leaves file and open tab", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(false);
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
  useEditorStore.getState().bindApi(
    createMemoryEditorApi({ files: { "/proj/a.ts": "hello" } }),
  );
  useEditorStore.setState({ projectRoot: folderPath });
  await useEditorStore.getState().openFile(folderPath, "/proj/a.ts");

  render(<ExplorerPanel explorerApi={api} />);
  const fileRow = await screen.findByText("a.ts");
  fireEvent.contextMenu(fileRow);
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));

  expect(screen.getByText("a.ts")).toBeInTheDocument();
  expect(useEditorStore.getState().tabs.map((t) => t.id)).toEqual(["/proj/a.ts"]);
  expect(window.confirm).toHaveBeenCalled();
});

it("context menu Delete OK closes dirty open tab without save prompt", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(true);
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
  useEditorStore.getState().bindApi(
    createMemoryEditorApi({ files: { "/proj/a.ts": "hello" } }),
  );
  useEditorStore.setState({ projectRoot: folderPath });
  await useEditorStore.getState().openFile(folderPath, "/proj/a.ts");
  useEditorStore.getState().setContentFromEditor("dirty");

  render(<ExplorerPanel explorerApi={api} />);
  fireEvent.contextMenu(await screen.findByText("a.ts"));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));

  await waitFor(() => {
    expect(screen.queryByText("a.ts")).not.toBeInTheDocument();
  });
  expect(useEditorStore.getState().tabs).toEqual([]);
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining("1 open editor tab(s) will close"),
  );
});

it("context menu Delete folder closes nested open tabs", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const folderPath = "/proj";
  const subDir = "/proj/src";
  useProjectStore.getState().createProjectWithRootTrunk({
    folderPath,
    nowIso: "2026-07-10T00:00:00.000Z",
  });
  const api = createMemoryExplorerApi({
    projectRoot: folderPath,
    dirs: {
      [folderPath]: [{ name: "src", path: subDir, isDir: true }],
      [subDir]: [{ name: "a.ts", path: "/proj/src/a.ts", isDir: false }],
    },
  });
  useExplorerStore.getState().bindApi(api);
  await useExplorerStore.getState().loadRoot();
  await useExplorerStore.getState().toggleExpanded(subDir);

  useEditorStore.getState().bindApi(
    createMemoryEditorApi({ files: { "/proj/src/a.ts": "hello" } }),
  );
  useEditorStore.setState({ projectRoot: folderPath });
  await useEditorStore.getState().openFile(folderPath, "/proj/src/a.ts");

  render(<ExplorerPanel explorerApi={api} />);
  fireEvent.contextMenu(await screen.findByText("src"));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));

  await waitFor(() => {
    expect(screen.queryByText("src")).not.toBeInTheDocument();
  });
  expect(useEditorStore.getState().tabs).toEqual([]);
});

it("context menu Delete leaves tabs open when trash fails", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "confirm").mockReturnValue(true);
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
  api.trash = async () => {
    throw new Error("trash failed");
  };
  useEditorStore.getState().bindApi(
    createMemoryEditorApi({ files: { "/proj/a.ts": "hello" } }),
  );
  useEditorStore.setState({ projectRoot: folderPath });
  await useEditorStore.getState().openFile(folderPath, "/proj/a.ts");

  render(<ExplorerPanel explorerApi={api} />);
  fireEvent.contextMenu(await screen.findByText("a.ts"));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));

  await waitFor(() => {
    expect(useExplorerStore.getState().error).toMatch(/trash failed/i);
  });
  expect(useEditorStore.getState().tabs.map((t) => t.id)).toEqual(["/proj/a.ts"]);
  expect(screen.getByText("a.ts")).toBeInTheDocument();
});
```

If `loadRoot` / `toggleExpanded` / folder row targeting differs, follow existing nested-folder tests in `ExplorerTree.test.tsx` / this file.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bunx vitest run src/modules/explorer/ui/ExplorerPanel.test.tsx`

Expected: FAIL (no confirm; tabs still open after delete; cancel does not apply).

- [ ] **Step 3: Implement `handleDelete`**

In `ExplorerContextMenu.tsx`:

1. Import `useEditorStore` from `../../editor/state/editorStore`.
2. Import helpers from `../domain/explorerDeleteEditorTabs`.
3. Replace `handleDelete` with:

```ts
const handleDelete = async (path: string) => {
  const { api, projectRoot, refresh } = useExplorerStore.getState();
  if (!api || !projectRoot) {
    return;
  }

  const entry = findEntry(path);
  const isDir =
    entry?.isDir ?? Boolean(useExplorerStore.getState().childrenByPath[path]);
  const name = entry?.name ?? path.slice(path.lastIndexOf("/") + 1) ?? path;

  const tabIds = useEditorStore.getState().tabs.map((t) => t.id);
  const matching = matchingEditorTabIdsForDelete(tabIds, path, isDir);
  if (!window.confirm(explorerDeleteConfirmMessage(name, matching.length))) {
    return;
  }

  try {
    await api.trash(projectRoot, path);
    await refresh();
    const { closeTab } = useEditorStore.getState();
    for (const id of matching) {
      closeTab(id);
    }
  } catch (error) {
    setExplorerError(error);
  }
};
```

Do **not** re-query matching after trash — use the pre-confirm `matching` list so a failed mid-loop cannot partially close on a later retry path; trash either succeeds fully or throws before closes.

- [ ] **Step 4: Run focused tests — expect PASS**

```bash
bunx vitest run src/modules/explorer/domain/explorerDeleteEditorTabs.test.ts \
  src/modules/explorer/ui/ExplorerPanel.test.tsx
```

Expected: PASS.

Then: `bunx vitest run src/modules/explorer` — all PASS (pre-existing noise only if already known elsewhere; do not “fix” unrelated failures).

- [ ] **Step 5: Commit**

```bash
git add src/modules/explorer/ui/ExplorerContextMenu.tsx \
  src/modules/explorer/ui/ExplorerPanel.test.tsx
git commit -m "$(cat <<'EOF'
Confirm Explorer delete and close matching editor tabs.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| `window.confirm` before trash | 2 |
| Copy without tab warning | 1 + 2 |
| Copy with N-tab warning | 1 + 2 |
| File exact match | 1 + 2 |
| Folder cascade (`/` prefix) | 1 + 2 |
| Cancel → no trash / no close | 2 |
| OK → trash → refresh → closeTab | 2 |
| Dirty discard (no Save prompt) | 2 |
| Trash failure leaves tabs | 2 |
| Untitled / unrelated untouched | 1 (filter) + 2 |
| No AlertDialog / no FS watchers | — (out of scope) |
