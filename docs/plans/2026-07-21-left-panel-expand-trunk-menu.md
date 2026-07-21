# Left Panel Expand + Trunk Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smooth project expand/collapse in the left panel, and trunk right-click menu with inline rename, pin/unpin, and delete.

**Architecture:** CSS grid `0fr`/`1fr` expand wrapper on project trunk lists; Base UI context menu on trunk rows; `renameTrunk` in `projectStore`; remove trunk row icon buttons.

**Tech Stack:** React 19, Zustand, Vitest, Base UI context menu, existing project module.

**Spec:** `docs/specs/2026-07-21-left-panel-expand-trunk-menu-design.md`

## Global Constraints

- Expand: CSS grid `0fr` ↔ `1fr`, ~180ms ease-out; `prefers-reduced-motion` → no transition.
- Trunk menu only: Rename, Pin/Unpin, Delete. Project rows unchanged.
- Rename: inline (Enter commit, Esc/blur cancel); empty/whitespace title → no-op.
- Remove always-visible pin/delete icon buttons on trunk rows.
- Prefer `bun run test` / targeted Vitest paths.
- Plans/specs under `docs/plans` and `docs/specs`.

## File structure

| File | Responsibility |
| --- | --- |
| `src/modules/project/state/projectStore.ts` | `renameTrunk` |
| `src/modules/project/state/projectStore.test.ts` | Store rename tests |
| `src/modules/project/ui/projectLeftPanel.tsx` | Smooth expand wrapper around trunks |
| `src/modules/project/ui/projectTrunkTree.tsx` | Context menu + inline rename; drop icon buttons |
| `src/modules/project/ui/projectTrunkRenameInput.tsx` | Inline rename input (explorer-like) |
| `src/modules/project/ui/projectLeftPanel.test.tsx` | Update delete/pin trunk tests; add menu/rename/expand coverage |

---

### Task 1: `renameTrunk` store action

**Files:**
- Modify: `src/modules/project/state/projectStore.ts`
- Modify: `src/modules/project/state/projectStore.test.ts`

**Interfaces:**
- Produces: `renameTrunk(trunkId: string, title: string): void`

- [ ] **Step 1: Write failing tests**

Append to `projectStore.test.ts`:

```ts
  it("renameTrunk updates title", () => {
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().renameTrunk(trunk.id, "Renamed");
    expect(useProjectStore.getState().trunks.find((t) => t.id === trunk.id)?.title).toBe(
      "Renamed",
    );
  });

  it("renameTrunk ignores empty or whitespace titles", () => {
    const { trunk } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().renameTrunk(trunk.id, "  ");
    expect(useProjectStore.getState().trunks.find((t) => t.id === trunk.id)?.title).toBe(
      "default",
    );
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun run test src/modules/project/state/projectStore.test.ts`

- [ ] **Step 3: Implement**

Add to `ExplorerState`-equivalent `ProjectStore` interface and implementation:

```ts
renameTrunk: (trunkId, title) => {
  const trimmed = title.trim();
  if (!trimmed) return;
  set((state) => ({
    trunks: state.trunks.map((t) =>
      t.id === trunkId ? { ...t, title: trimmed } : t,
    ),
  }));
},
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/state/projectStore.ts src/modules/project/state/projectStore.test.ts
git commit -m "$(cat <<'EOF'
Add renameTrunk store action for left-panel trunks.

EOF
)"
```

---

### Task 2: Smooth project expand + trunk context menu

**Files:**
- Create: `src/modules/project/ui/projectTrunkRenameInput.tsx`
- Modify: `src/modules/project/ui/projectTrunkTree.tsx`
- Modify: `src/modules/project/ui/projectLeftPanel.tsx`
- Modify: `src/modules/project/ui/projectLeftPanel.test.tsx`

**Interfaces:**
- Consumes: `renameTrunk`, `setTrunkPinned`, `deleteTrunkCascade`
- Produces: animated expand; trunk context menu; inline rename

- [ ] **Step 1: Update / add failing UI tests**

In `projectLeftPanel.test.tsx`:

- Change trunk delete test to open context menu (right-click trunk) → click Delete (no `Delete trunk …` icon button).
- Change any trunk pin assertions similarly if present.
- Add: right-click → Rename → type → Enter updates title.
- Add: expand/collapse still shows/hides trunk buttons (content presence).

Example delete via menu:

```ts
  it("deletes a trunk from the context menu when confirm is accepted", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { project } = useProjectStore.getState().createProjectWithRootTrunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().addRootTrunk({
      projectId: project.id,
      title: "Sibling",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.pointer({
      keys: "[MouseRight>]",
      target: screen.getByRole("button", { name: "default" }),
    });
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(confirmSpy).toHaveBeenCalledWith("Delete this trunk?");
    expect(useProjectStore.getState().trunks.find((c) => c.title === "default")).toBeUndefined();
    confirmSpy.mockRestore();
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun run test src/modules/project/ui/projectLeftPanel.test.tsx`

- [ ] **Step 3: Implement expand wrapper in `ProjectRow`**

Replace conditional `{expanded ? <ProjectTrunkTree … /> : null}` with:

```tsx
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-[180ms] ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ProjectTrunkTree
            projectId={project.id}
            trunks={trunks}
            activeTrunkId={activeTrunkId}
            visibleTrunkIds={visibleTrunkIds}
          />
        </div>
      </div>
```

- [ ] **Step 4: Implement trunk menu + rename input**

Create `projectTrunkRenameInput.tsx` mirroring explorer rename input, calling `renameTrunk` / local cancel.

Rewrite `TrunkRow` to use `ContextMenu`, remove `PanelToolButton`s, support `renamingTrunkId` state lifted in `ProjectTrunkTree`.

Menu labels: `Rename`, `Pin` / `Unpin`, `Delete`. Content class: `min-w-40 font-mono text-[11px] tracking-[0.08em]`.

- [ ] **Step 5: Run tests — expect PASS**

Run: `bun run test src/modules/project/ui/projectLeftPanel.test.tsx src/modules/project/state/projectStore.test.ts`

- [ ] **Step 6: Commit**

```bash
git add \
  src/modules/project/ui/projectTrunkRenameInput.tsx \
  src/modules/project/ui/projectTrunkTree.tsx \
  src/modules/project/ui/projectLeftPanel.tsx \
  src/modules/project/ui/projectLeftPanel.test.tsx
git commit -m "$(cat <<'EOF'
Animate project expand and add trunk context menu with rename.

EOF
)"
```

---

## Self-review checklist (author)

- Spec coverage: expand animation, trunk menu, inline rename, icon removal, store rename — Tasks 1–2.
- Project-row context menu left out of scope.
- Out of scope left out: drag/drop, group rename, project menu.
