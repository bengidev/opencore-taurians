# Editor tab context menu design

Date: 2026-07-22  
Status: Approved for implementation planning  
Scope: Move Save As (and related tab actions) from the tab-strip chrome into a per-tab right-click context menu. Extends Phase 2b UI; no new Desktop commands.

Related: Phase 2b — `docs/specs/2026-07-22-editor-tabs-phase2b-design.md`.

## Goal

Keep the Editor tab strip visually quiet: **+** and per-tab **×** stay. **Save**, **Save As…**, **Close**, **Close Others**, and **Close All** live on a right-click menu on the file tab itself — not as buttons beside the open tabs.

## Decisions (locked)

| Topic | Choice |
| ----- | ------ |
| Approach | **A** — per-tab shadcn/Base UI `ContextMenu` (same stack as Explorer/trunk) |
| Strip **Save As…** button | **Remove** |
| Per-tab **×** | **Keep** (same dirty-close path as menu **Close**) |
| Menu target | The right-clicked tab (focus/select it on open) |
| Menu items | Save · Save As… · separator · Close · Close Others · Close All |
| Untitled **Save** | Opens Save As for that tab (same contract as ⌘S on Untitled) |
| Path **Save** | `saveTab(id)` via existing store |
| **Save As…** | Opens existing `EditorSaveAsDialog` for that tab id (not only active) |
| **Close** | Existing `onRequestCloseTab(id)` (dirty prompt / Untitled → Save As) |
| **Close Others** / **Close All** | Sequential closes in open order; each dirty tab uses the existing close prompt; **Cancel** stops the remaining closes |
| **Close Others** disabled | When fewer than two tabs are open |
| Out of scope | Copy Path, tab reorder, new Desktop I/O, Phase 2c |

## UI behavior

### Tab strip

- Tabs: label + **×** (unchanged visually aside from context-menu trigger wrapping).
- **+**: unchanged (new Untitled when `projectRoot` is set).
- No standalone **Save As…** control on the strip.

### Context menu

Right-click a tab:

1. Select that tab (`setActiveTabId`).
2. Show menu ordered as:
   - **Save**
   - **Save As…**
   - separator
   - **Close**
   - **Close Others** (disabled if `tabs.length < 2`)
   - **Close All**

Styling matches existing Explorer/trunk context menus (shared `ContextMenu*` primitives).

### Close Others / Close All

For each tab to close (others = all except the menu target; all = every tab), in current open order:

1. If clean → `closeTab(id)`.
2. If dirty → same dialog flow as **×** / menu **Close** (path: Save / Don’t save / Cancel; Untitled Save → Save As then close on success).
3. If the user **Cancel**s a dirty prompt (or Save As cancel/fail that aborts close) → **stop**; leave remaining tabs open.

Do not invent a bulk “discard all” shortcut in this slice.

## Architecture

| Layer | Change |
| ----- | ------ |
| `EditorTabStrip` | Remove Save As button; wrap each tab in `ContextMenu`; wire menu actions |
| `EditorCardHeader` | `onRequestSaveAs(id)` (tab-scoped); orchestrate sequential Close Others / Close All via existing close/Save As paths |
| Store | No new persistence APIs required; reuse `saveTab`, `closeTab`, `saveAs`, dirty checks |
| Desktop | Unchanged |

Optional small helper (header or strip): async `closeTabsSequentially(ids: string[])` that awaits each dirty prompt — keep UI orchestration out of the Zustand store unless tests demand it.

## Testing

- Strip no longer exposes a **Save As…** button role.
- Right-click / context-menu trigger on a tab shows items; **Save As…** opens dialog for that tab id.
- **Save** on path tab calls save; on Untitled requests Save As.
- **Close** matches **×** dirty behavior.
- **Close Others** / **Close All**: clean tabs close; dirty cancel leaves later tabs open.
- **Close Others** disabled with a single tab.

## Spec self-review

- No TBD placeholders; menu order and disable rules explicit.
- Close Others/All cancel semantics aligned with existing single-tab close (no silent discard).
- Does not contradict Phase 2b I/O rules (Untitled still never `writeFile`).
