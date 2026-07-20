# Adaptive window layout — design

Date: 2026-07-20  
Branch / worktree: `feat/gui-scale`  
Status: approved for implementation planning

## Goal

Make every module’s UI stay usable when the window is **manually resized** and when **GUI scale** changes the window, by **compressing in place** (no auto-hiding chrome). Side panels, center, and content reflow proportionally under squeeze while GUI scale behavior stays as shipped today.

## Decisions

| Topic | Choice |
| --- | --- |
| Behavior under squeeze | Compress in place — keep all visible panels; shrink gaps/padding/content |
| Column priority | Proportional shrink across left / center / right |
| Manual resize vs scale | Keep snap — scale owns size when the slider moves; free resize is temporary until the next scale change |
| Approach | Flex ratios in shell + fluid CSS in other modules (Approach A) |
| Vertical splitters | Out of scope for v1 — main card absorbs height; bottom panel stays fixed chrome height |

## Relationship to GUI scale

Unchanged from `docs/specs/2026-07-19-gui-scale-design.md`:

- CSS `zoom` on the session root, with inverse layout compensation so content is not double-shrunk.
- Window size tracks `base × scale` (onboarding / shell bases), clamped to monitor work area.
- Slider change snaps the window back to `base × scale`.
- Between snaps, manual resize drives adaptive layout.

This design does **not** persist free-form window size across scale changes.

## Architecture

### Preferred vs displayed panel widths

- `leftPanelWidth` / `rightPanelWidth` in the shell store remain **preferred** widths (user drag target / defaults).
- Drag clamp rules stay `MIN_SHELL_PANEL_WIDTH` / `MAX_SHELL_PANEL_WIDTH` (160 / 480) on preferred values.
- At layout time, shell derives **displayed** widths so visible columns share squeeze.

### Distributor (pure helper)

`distributeShellColumnWidths(input) → { left, center, right }`

Inputs:

- Content width available to the shell row (logical CSS pixels inside the scaled root).
- Preferred left/right widths.
- Visibility of left/right panels.
- Floors: `MIN_SHELL_PANEL_WIDTH` (160), `MIN_SHELL_CENTER_WIDTH` (320).
- Reference width: shell base content width `SHELL_WINDOW_SIZE.width` (1280). Preferred panel widths apply in full at this width; below it, columns shrink together.

Algorithm:

1. `leftTarget = leftVisible ? leftPreferred : 0` (same for right). Hidden panels contribute `0`.
2. `refCenter = max(MIN_SHELL_CENTER_WIDTH, SHELL_WINDOW_SIZE.width - leftTarget - rightTarget)`.
3. If `available >= SHELL_WINDOW_SIZE.width`: roomy — panels at preferred targets; center gets `available - leftTarget - rightTarget`.
4. If `available < SHELL_WINDOW_SIZE.width`: proportional —  
   `scale = available / SHELL_WINDOW_SIZE.width`,  
   `left = round(leftTarget * scale)`, `right = round(rightTarget * scale)`, `center = available - left - right`.
5. Clamp each visible column to its floor (`MIN_SHELL_PANEL_WIDTH` / `MIN_SHELL_CENTER_WIDTH`). If floors still exceed `available`, keep floors and accept overflow only as **inner content scroll**, not by crushing chrome below floors.
6. Fix rounding so `left + center + right === available` when floors fit.

`ShellScreen` applies displayed widths to `ShellPanelSlot` and resize gutters. Resize handles write **preferred** width; layout re-derives display on the next render / resize. Above the reference width, panels do **not** grow past preferred (center absorbs extra space).

### Vertical shell behavior

- Keep the `h-full` / `min-h-0` chain from root → shell → panels.
- Bottom panel stays `shrink-0`; main card absorbs height.
- No new vertical splitter in v1.

### Module reflow (fluid CSS)

Shared rules:

- Prefer `min-h-0` / `min-w-0` + flex/grid fill over viewport units inside the scaled session root.
- Replace hard fixed heights with `clamp` / `%` / `minmax(0, 1fr)`.
- Compress padding/gaps before clipping.
- Truncate or scroll **content**; keep chrome rows (headers, tab bars) readable.

Module notes:

| Module | Changes |
| --- | --- |
| Onboarding | Fluid orb height (e.g. `clamp`); tighter `py`/`gap` when short; allow earlier single-column when narrow; keep brand/CTA visible |
| Workspace popup | `w-full` + horizontal margin; `max-h` + internal scroll on short windows; slightly tighter padding when needed |
| Settings | Ensure `min-w-0` / wrapping so rows don’t force horizontal overflow (page already scrolls vertically) |
| Explorer / project / chat | Rely on existing `overflow-auto` + truncate; verify under narrow **displayed** panel widths |

No per-module JS layout controllers.

## Data flow

```
Window resize / panel drag / panel visibility / GUI scale snap
        │
        ▼
 preferred panel widths (store) + available content width
        │
        ▼
 distributeShellColumnWidths (pure)
        │
        ├──► displayed left/right slot widths
        └──► center flex/min constraints
                │
                ▼
        module CSS reflow (fluid sizes, scroll/truncate)
```

GUI scale path (unchanged): preference → zoom + inverse layout → `base × scale` window snap → distributor runs on new size.

## Edge cases

- One or both side panels hidden: proportion only **visible** columns + center.
- Preferred widths already too wide: compress on mount/resize immediately.
- GUI scale change: snap window, then redistribute; zoom compensation unchanged.
- Work-area clamp at high scale: layout adapts to the clamped window.
- Extremely small manual resize: hit floors; content scrolls inside panels.
- Resize during panel open/close animation: use current visibility + preferred widths; no special animation solver.
- Do not animate width redistribution on window resize (instant geometry). Panel open/close motion stays as today.

## Out of scope

- Auto-collapsing panels into drawers/overlays.
- Persisting free-form window size across scale changes.
- Changing default base window sizes (`960×680` / `1280×800`).
- A JS constraint-solver layout engine.
- Vertical panel splitters / bottom-panel proportional height.
- Per-monitor different layout preferences.

## Testing

- Unit: `distributeShellColumnWidths` — above reference (center absorbs), at reference (preferred panels), below reference (proportional), one-panel-hidden, both-hidden, floor clamping.
- Shell UI: narrow container with both panels visible → displayed widths &lt; preferred but proportional; drag still updates preferred.
- Onboarding: short/narrow container → layout does not overflow the root.
- Workspace popup: narrow viewport → dialog remains fully on-screen.
- Existing GUI scale tests remain green (snap, clamp, zoom, inverse layout).

## Success criteria

1. Manually shrinking the shell window compresses left / center / right proportionally without auto-hiding panels.
2. Dragged panel preferences are preserved and restored when space returns.
3. Onboarding and workspace popup remain fully usable (no chopped chrome) at small window sizes and at 50% GUI scale.
4. Moving the GUI scale slider still snaps the window to `base × scale`.
5. Explorer/project trees remain scrollable/truncating under narrow displayed panel widths.
