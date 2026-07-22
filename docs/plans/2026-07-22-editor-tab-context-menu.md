# Editor Tab Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Save / Save As… / Close / Close Others / Close All into a per-tab right-click context menu; remove the strip Save As… button; keep `+` and per-tab `×`.

**Architecture:** Wrap each tab in the existing shadcn/Base UI `ContextMenu` (same pattern as project trunks). Tab-scoped Save As via `onRequestSaveAs(id)`. Sequential Close Others / Close All await an awaitable dirty-close prompt in `EditorCardHeader` (reuse existing close + Save As dialogs; Cancel stops the queue).

**Tech Stack:** React 19, Zustand, Vitest, Testing Library, `@base-ui/react` ContextMenu via `@/components/ui/context-menu`, Bun tests.

**Spec:** `docs/specs/2026-07-22-editor-tab-context-menu-design.md`

## Global Constraints

- Extends Phase 2b UI only — no new Desktop commands, no Copy Path, no tab reorder, no Phase 2c.
- Untitled never calls `writeFile`; Untitled **Save** opens Save As for that tab.
- Menu target = right-clicked tab; select it on open (`setActiveTabId`).
- **Close** / **×** share the same dirty-close path.
- **Close Others** / **Close All**: sequential in open order; dirty → existing Save / Don’t save / Cancel (Untitled Save → Save As); **Cancel** (or Save As abort that cancels close) **stops** remaining closes.
- **Close Others** disabled when `tabs.length < 2`.
- Keep per-tab **×**; remove strip **Save As…** button.
- Package manager / tests: **Bun** — `bunx vitest run …` / `bun run test`.
- Context menu class: match trunk/explorer — `min-w-36 font-mono text-xs tracking-[0.08em]`.

---

## File structure

| Path | Role |
| ---- | ---- |
| `src/modules/editor/ui/closeTabPromptBridge.ts` | Awaitable dirty-close prompt for sequential closes |
| `src/modules/editor/ui/EditorTabStrip.tsx` | Per-tab ContextMenu; remove Save As button |
| `src/modules/editor/ui/EditorTabStrip.test.tsx` | Menu + button removal + action spies |
| `src/modules/editor/ui/EditorCardHeader.tsx` | `onRequestSaveAs(id)`; register close prompt; Close Others/All queue |
| `src/modules/editor/ui/EditorCardHeader.test.tsx` | Sequential close cancel stops remainder |
| `src/modules/editor/CONTEXT.md` | Save As via tab context menu (not strip button) |

---

### Task 1: Awaitable close prompt bridge + header registration

**Files:**
- Create: `src/modules/editor/ui/closeTabPromptBridge.ts`
- Modify: `src/modules/editor/ui/EditorCardHeader.tsx`
- Modify: `src/modules/editor/ui/EditorCardHeader.test.tsx` (add cases; file already exists)

**Interfaces:**
- Consumes: existing `EditorCloseTabDialog`, `pendingCloseAfterSaveAsIdRef` / Save As success/cancel paths
- Produces:

```ts
// closeTabPromptBridge.ts
export type CloseTabPromptResult = "closed" | "cancelled";

export function registerCloseTabPromptHandler(
  handler: ((id: string) => Promise<CloseTabPromptResult>) | null,
): void;

export async function promptCloseTab(id: string): Promise<CloseTabPromptResult>;
// if no handler → "cancelled"
```

Header registers a handler that:
1. If tab missing → `"closed"`.
2. If not dirty → `closeTab(id)` → `"closed"`.
3. If dirty → set `pendingCloseId`, store resolver; resolve when close completes or user cancels.

Resolution rules (wire into existing header handlers):
- Don’t save / path Save success that closes tab → `"closed"`.
- Cancel on close dialog → `"cancelled"`.
- Untitled Save → Save As for close: keep promise pending; `handleSaveAsSuccess` when `pendingCloseAfterSaveAsIdRef` was set → `"closed"`; Save As dismiss/cancel that clears close intent → `"cancelled"`.
- Single-tab `×` / menu Close may keep calling local `onRequestCloseTab` **or** go through `promptCloseTab` — prefer **one path**: `onRequestCloseTab` becomes `void promptCloseTab(id)` (fire-and-forget for × is OK).

- [ ] **Step 1: Write failing tests for awaitable close**

In `EditorCardHeader.test.tsx`, add (adapt imports/helpers to existing file patterns):

```ts
it("promptCloseTab closes a clean tab", async () => {
  // seed clean tab FILE_A, render EditorCardHeader
  const result = await promptCloseTab(FILE_A);
  expect(result).toBe("closed");
  expect(useEditorStore.getState().tabs.map((t) => t.id)).not.toContain(FILE_A);
});

it("promptCloseTab cancel on dirty leaves tab open", async () => {
  // seed dirty FILE_A, render header
  const pending = promptCloseTab(FILE_A);
  await screen.findByText(/save changes/i);
  await userEvent.setup().click(screen.getByRole("button", { name: /^cancel$/i }));
  expect(await pending).toBe("cancelled");
  expect(useEditorStore.getState().tabs.map((t) => t.id)).toContain(FILE_A);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/EditorCardHeader.test.tsx`  
Expected: FAIL — `promptCloseTab` / bridge missing or not registered.

- [ ] **Step 3: Implement bridge + header registration**

`closeTabPromptBridge.ts`:

```ts
export type CloseTabPromptResult = "closed" | "cancelled";

let handler: ((id: string) => Promise<CloseTabPromptResult>) | null = null;

export function registerCloseTabPromptHandler(
  next: ((id: string) => Promise<CloseTabPromptResult>) | null,
): void {
  handler = next;
}

export async function promptCloseTab(id: string): Promise<CloseTabPromptResult> {
  if (!handler) return "cancelled";
  return handler(id);
}
```

In `EditorCardHeader`, register in the existing `useEffect` (alongside Save As / quit handlers):

```ts
const closePromptResolverRef = useRef<((r: CloseTabPromptResult) => void) | null>(
  null,
);

const resolveClosePrompt = (result: CloseTabPromptResult) => {
  closePromptResolverRef.current?.(result);
  closePromptResolverRef.current = null;
};

// registerCloseTabPromptHandler(async (id) => { ... as above ... })
```

When close dialog `onOpenChange(false)` from Cancel (and default cancel path), call `resolveClosePrompt("cancelled")` if a resolver is waiting.  
When tab actually closes (Don’t save / successful path save / Save As close success), call `resolveClosePrompt("closed")`.  
Do **not** resolve `"cancelled"` when Untitled Save hands off to Save As (mirror quit handoff: skip cancel resolve on that dismiss).

Keep `onRequestCloseTab` as:

```ts
const onRequestCloseTab = (id: string) => {
  void promptCloseTab(id);
};
```

…after the handler is registered (module-level `promptCloseTab`), so × and menu Close share one path.

- [ ] **Step 4: Run — expect PASS**

Run: `bunx vitest run src/modules/editor/ui/EditorCardHeader.test.tsx`  
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/closeTabPromptBridge.ts src/modules/editor/ui/EditorCardHeader.tsx src/modules/editor/ui/EditorCardHeader.test.tsx
git commit -m "Add awaitable close prompt for sequential tab closes."
```

---

### Task 2: Per-tab context menu — Save / Save As / Close; remove strip button

**Files:**
- Modify: `src/modules/editor/ui/EditorTabStrip.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.test.tsx`
- Modify: `src/modules/editor/ui/EditorCardHeader.tsx` (`onRequestSaveAs(id: string)`)
- Modify: `src/modules/editor/CONTEXT.md`

**Interfaces:**
- Consumes: `promptCloseTab` / `onRequestCloseTab`, `isUntitledId`, `saveTab`, `setActiveTabId`
- Produces:

```ts
export interface EditorTabStripProps {
  onRequestCloseTab: (id: string) => void;
  onRequestSaveAs: (id: string) => void;
  onRequestCloseOthers: (keepId: string) => void; // stub OK until Task 3, or no-op
  onRequestCloseAll: () => void; // stub OK until Task 3, or no-op
}
```

For this task, menu may include Close Others / Close All items calling the stubs; Task 3 wires real behavior. Prefer showing all five items now with Others/All calling the new props (header stubs no-op) **or** add Others/All only in Task 3 — **prefer include items now** so strip UI is complete; header stubs:

```ts
onRequestCloseOthers={() => {}}
onRequestCloseAll={() => {}}
```

until Task 3.

- [ ] **Step 1: Failing strip tests**

```ts
it("does not render a strip Save As button", () => {
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: FILE_A }],
    activeTabId: FILE_A,
    buffers: { [FILE_A]: seedBuffer(FILE_A) },
  });
  render(
    <EditorTabStrip
      onRequestCloseTab={vi.fn()}
      onRequestSaveAs={vi.fn()}
      onRequestCloseOthers={vi.fn()}
      onRequestCloseAll={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: /^save as/i })).toBeNull();
});

it("tab context menu Save As calls onRequestSaveAs with that tab id", async () => {
  const onRequestSaveAs = vi.fn();
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: FILE_A }, { id: FILE_B }],
    activeTabId: FILE_B,
    buffers: {
      [FILE_A]: seedBuffer(FILE_A),
      [FILE_B]: seedBuffer(FILE_B),
    },
  });
  render(
    <EditorTabStrip
      onRequestCloseTab={vi.fn()}
      onRequestSaveAs={onRequestSaveAs}
      onRequestCloseOthers={vi.fn()}
      onRequestCloseAll={vi.fn()}
    />,
  );
  fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: /save as/i }));
  expect(onRequestSaveAs).toHaveBeenCalledWith(FILE_A);
  expect(useEditorStore.getState().activeTabId).toBe(FILE_A);
});

it("tab context menu Save on path tab calls saveTab", async () => {
  useEditorStore.getState().bindApi(createMemoryEditorApi({ files: { [FILE_A]: "x" } }));
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: FILE_A }],
    activeTabId: FILE_A,
    buffers: { [FILE_A]: seedBuffer(FILE_A, { content: "y", dirty: true }) },
  });
  const saveTab = vi.spyOn(useEditorStore.getState(), "saveTab");
  render(
    <EditorTabStrip
      onRequestCloseTab={vi.fn()}
      onRequestSaveAs={vi.fn()}
      onRequestCloseOthers={vi.fn()}
      onRequestCloseAll={vi.fn()}
    />,
  );
  fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
  await userEvent.setup().click(await screen.findByRole("menuitem", { name: /^save$/i }));
  expect(saveTab).toHaveBeenCalledWith(FILE_A);
});

it("Close Others is disabled when only one tab is open", async () => {
  useEditorStore.setState({
    projectRoot: PROJECT_ROOT,
    tabs: [{ id: FILE_A }],
    activeTabId: FILE_A,
    buffers: { [FILE_A]: seedBuffer(FILE_A) },
  });
  render(
    <EditorTabStrip
      onRequestCloseTab={vi.fn()}
      onRequestSaveAs={vi.fn()}
      onRequestCloseOthers={vi.fn()}
      onRequestCloseAll={vi.fn()}
    />,
  );
  fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
  const item = await screen.findByRole("menuitem", { name: /close others/i });
  expect(item).toHaveAttribute("aria-disabled", "true");
});
```

Update all existing strip renders to pass the new props.

- [ ] **Step 2: Run — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx`  
Expected: FAIL (Save As button still present / no menu).

- [ ] **Step 3: Implement strip menu + header Save As(id)**

Sketch for each tab (mirror `projectTrunkTree` ContextMenuTrigger `render` button pattern as needed):

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { isUntitledId } from "../state/editorTabId";

const editorTabContextMenuClassName =
  "min-w-36 font-mono text-xs tracking-[0.08em]";

// inside map:
<ContextMenu
  key={tab.id}
  onOpenChange={(open) => {
    if (open) setActiveTabId(tab.id);
  }}
>
  <div className="flex min-w-0 items-center">
    <ContextMenuTrigger
      render={
        <button
          type="button"
          role="tab"
          aria-selected={selected}
          aria-label={displayLabel}
          className="…"
        />
      }
      onClick={() => setActiveTabId(tab.id)}
    >
      {displayLabel}
    </ContextMenuTrigger>
    <button type="button" aria-label={`Close ${label}`} … onClick={() => onRequestCloseTab(tab.id)}>
      ×
    </button>
  </div>
  <ContextMenuContent className={editorTabContextMenuClassName}>
    <ContextMenuItem
      onClick={() => {
        if (isUntitledId(tab.id)) onRequestSaveAs(tab.id);
        else void useEditorStore.getState().saveTab(tab.id);
      }}
    >
      Save
    </ContextMenuItem>
    <ContextMenuItem onClick={() => onRequestSaveAs(tab.id)}>Save As…</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => onRequestCloseTab(tab.id)}>Close</ContextMenuItem>
    <ContextMenuItem
      disabled={tabs.length < 2}
      onClick={() => onRequestCloseOthers(tab.id)}
    >
      Close Others
    </ContextMenuItem>
    <ContextMenuItem onClick={() => onRequestCloseAll()}>Close All</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

Remove the strip Save As… `<button>`.

Header:

```ts
const onRequestSaveAs = (id: string) => {
  saveAsOnSuccessRef.current = null;
  pendingCloseAfterSaveAsIdRef.current = null;
  setPendingSaveAsSourceId(id);
};
```

Pass stub Others/All until Task 3. Update CONTEXT.md: Save As available from tab context menu (not strip button).

- [ ] **Step 4: Run — expect PASS**

Run: `bunx vitest run src/modules/editor/ui/EditorTabStrip.test.tsx src/modules/editor/ui/EditorCardHeader.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/EditorTabStrip.tsx src/modules/editor/ui/EditorTabStrip.test.tsx src/modules/editor/ui/EditorCardHeader.tsx src/modules/editor/CONTEXT.md
git commit -m "Move editor Save As into per-tab context menu."
```

---

### Task 3: Wire Close Others / Close All sequential queue

**Files:**
- Modify: `src/modules/editor/ui/EditorCardHeader.tsx`
- Modify: `src/modules/editor/ui/EditorCardHeader.test.tsx`
- Modify: `src/modules/editor/ui/EditorTabStrip.test.tsx` (optional spy that Others/All call props — if not already in Task 2)

**Interfaces:**
- Consumes: `promptCloseTab` from Task 1
- Produces:

```ts
async function closeTabsSequentially(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (!useEditorStore.getState().tabs.some((t) => t.id === id)) continue;
    const result = await promptCloseTab(id);
    if (result === "cancelled") return;
  }
}

const onRequestCloseOthers = (keepId: string) => {
  const ids = useEditorStore
    .getState()
    .tabs.map((t) => t.id)
    .filter((id) => id !== keepId);
  void closeTabsSequentially(ids);
};

const onRequestCloseAll = () => {
  const ids = useEditorStore.getState().tabs.map((t) => t.id);
  void closeTabsSequentially(ids);
};
```

Snapshot the id list **when the action starts**; skip ids already gone; stop on `"cancelled"`.

- [ ] **Step 1: Failing header tests**

```ts
it("Close Others closes clean other tabs and keeps the target", async () => {
  const user = userEvent.setup();
  // seed FILE_A, FILE_B, FILE_C all clean; active B
  render(<EditorCardHeader />);
  fireEvent.contextMenu(screen.getByRole("tab", { name: /b\.ts/i }));
  await user.click(await screen.findByRole("menuitem", { name: /close others/i }));
  await waitFor(() => {
    expect(useEditorStore.getState().tabs.map((t) => t.id)).toEqual([FILE_B]);
  });
});

it("Close All stops after Cancel on a dirty tab", async () => {
  const user = userEvent.setup();
  // FILE_A clean, FILE_B dirty, FILE_C clean — open order A,B,C
  render(<EditorCardHeader />);
  fireEvent.contextMenu(screen.getByRole("tab", { name: /a\.ts/i }));
  await user.click(await screen.findByRole("menuitem", { name: /close all/i }));
  // A closes; dirty B prompts
  await screen.findByText(/save changes/i);
  await user.click(screen.getByRole("button", { name: /^cancel$/i }));
  await waitFor(() => {
    const ids = useEditorStore.getState().tabs.map((t) => t.id);
    expect(ids).toEqual([FILE_B, FILE_C]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `bunx vitest run src/modules/editor/ui/EditorCardHeader.test.tsx`  
Expected: FAIL (stubs / no sequential behavior).

- [ ] **Step 3: Implement sequential wiring in header**

Replace Task 2 stubs with `closeTabsSequentially` + `onRequestCloseOthers` / `onRequestCloseAll` as above. Pass real callbacks into `EditorTabStrip`.

- [ ] **Step 4: Full editor tests**

Run: `bunx vitest run src/modules/editor`  
Expected: PASS

Then: `bun run test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/editor/ui/EditorCardHeader.tsx src/modules/editor/ui/EditorCardHeader.test.tsx src/modules/editor/ui/EditorTabStrip.test.tsx
git commit -m "Wire Close Others and Close All with sequential dirty prompts."
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| Remove strip Save As button | 2 |
| Keep × | 2 |
| Per-tab ContextMenu | 2 |
| Select tab on menu open | 2 |
| Save / Save As… / Close items | 2 |
| Untitled Save → Save As | 2 |
| Path Save → saveTab | 2 |
| Close Others disabled when &lt; 2 tabs | 2 |
| Close Others / Close All sequential | 3 |
| Cancel stops remainder | 1+3 |
| Awaitable dirty close | 1 |
| CONTEXT.md update | 2 |
| No new Desktop / Copy Path / reorder | constraints |

---

## Self-review notes

- No TBD placeholders; `onRequestSaveAs(id)` and `promptCloseTab` signatures consistent across tasks.
- Task 2 stubs for Others/All are intentional so the menu chrome ships once; Task 3 only replaces stubs.
- Save As handoff must not resolve close prompt as `"cancelled"` (same class of bug fixed for quit in 2b).
