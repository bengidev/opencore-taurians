# Shell layout redesign — Design

Date: 2026-07-11  
Status: Approved for implementation planning

## Goal

Re-layout the workspace shell to match the approved wireframe: collapsible left and right sidebars, a self-contained center column (main-card tabs, main panel, bottom panel), and panel show/hide controls embedded in the panels and center chrome — without changing existing feature behavior (project navigator, main cards, persistence, resize).

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Scope | Layout and chrome only; no new main-card or navigator features |
| Mode bar | Remove full-width `ShellModeBar`; tabs move into center column |
| Bottom panel | Scoped to center column only; settings icon opens a sheet |
| Panel toggles | Dual-host single component: in panel header when open, in center tab bar when closed |
| Collapsed reopen | Center tab bar leading/trailing affordance (not keyboard-only) |
| Settings sheet v1 | Theme (light/dark) + shell panel preferences |
| Side panel resize | Keep existing drag handles |
| Right panel content | Remains placeholder |
| Animation | ~300ms off-canvas width transition on panel collapse/expand |

## Target layout

```
┌──────────┬─────────────────────────────┬──────────┐
│ Left     │ [chat] [terminal] [editor]  │ Right    │
│ panel    ├─────────────────────────────┤ panel    │
│          │ Main panel                  │          │
│ [toggle] │ (chat / terminal / editor)  │ [toggle] │
│          ├─────────────────────────────┤          │
│          │ [⚙]  bottom panel           │          │
└──────────┴─────────────────────────────┴──────────┘
```

When a sidebar is hidden, its toggle moves to the center tab row:

```
[Show left]  chat | terminal | editor  [Show right]
```

## Architecture

### `shell` (`src/modules/shell/`)

Owns all layout chrome changes:

- Grid orchestration in `shellScreen.tsx`
- Center column wrapper (`ShellCenterColumn`)
- Main-card tab bar (`ShellMainCardTabs`)
- Panel toggle primitive and dual-host placement
- Bottom panel settings entry + settings sheet
- Panel collapse animation

Does **not** own project navigator logic, chat content, or theme domain rules (consumes `onboarding` theme store).

### Unchanged module boundaries

- **`project`** — `ProjectLeftPanel` content unchanged; only hosted inside the restructured left sidebar
- **`chat`** — main-card chat UI unchanged
- **`onboarding`** — `ThemeProvider` / `useThemeStore` remain the theme source of truth
- **`session`** — boot/hydration unchanged

## Layout structure

### `ShellScreen` grid

Replace the current three-row grid (`mode bar | panels | bottom`) with a **single row**:

```tsx
grid-cols: [leftWidth?] minmax(0, 1fr) [rightWidth?]
```

- Remove `<ShellModeBar />`
- Center cell renders `<ShellCenterColumn />`
- Left/right cells unchanged in responsibility (aside wrappers + resize handles)
- Bottom panel is **not** a full-width row; it lives inside the center column

### `ShellCenterColumn` (new)

Internal `grid-rows-[auto_1fr_auto] min-h-0`:

| Row | Component | Role |
| --- | --- | --- |
| 1 | `ShellMainCardTabs` | Main-card switches (chat / terminal / editor) |
| 2 | `ShellMainPanel` | Existing stacked card views |
| 3 | `ShellBottomPanel` | Settings trigger + reserved status area |

### `ShellMainCardTabs` (new, replaces mode-bar tab section)

- Renders the same `MAIN_CARDS` buttons currently in `shellModeBar.tsx` (mono uppercase outline style)
- Layout: `flex items-center justify-between`
  - Leading cluster: left-panel toggle when `leftVisible === false`
  - Center cluster: main-card buttons
  - Trailing cluster: right-panel toggle when `rightVisible === false`
- State: `shellStore.activeMainCard` / `setActiveMainCard`

## Panel toggles

### `ShellPanelToggle` (new shared primitive)

Parameterized by `side: "left" | "right"`.

| State | Icon (lucide-react) | Label |
| --- | --- | --- |
| Panel open | `PanelLeftClose` / `PanelRightClose` | Hide left panel / Hide right panel |
| Panel closed | `PanelLeftOpen` / `PanelRightOpen` | Show left panel / Show right panel |

- Wrap with `PanelToolButton` (existing project module pattern) for tooltip + ghost icon styling
- Action: `toggleLeft()` / `toggleRight()` from `shellStore`
- **Mutual exclusivity:** render in exactly one host per side (panel header **or** center tab bar, never both)

### Panel headers (new thin strips)

**`ShellLeftPanelHeader`**

- Sits above `ProjectLeftPanel` inside `ShellLeftPanel`
- Renders `ShellPanelToggle side="left"` at the leading (outer) edge when `leftVisible`
- Height: compact (`h-9` or match tab bar), `border-b border-border`, horizontal padding aligned with panel chrome

**`ShellRightPanelHeader`**

- Sits above right panel placeholder content inside `ShellRightPanel`
- Renders `ShellPanelToggle side="right"` at the trailing (outer) edge when `rightVisible`
- Replaces the current static "Right Panel" label row (toggle + optional label can coexist)

### Collapse animation

- While `leftVisible` / `rightVisible` is true, panel participates in the grid at `leftPanelWidth` / `rightPanelWidth`
- On hide: animate width to `0` over ~300ms (`transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`)
- After transition completes, remove panel from grid (current `null` render) so center column expands
- On show: mount panel at target width (optional width animate from 0 — implement if straightforward; instant mount acceptable for v1)
- Resize handles remain active only while the panel is visible and width > 0

## Bottom panel & settings

### `ShellBottomPanel` (modify)

- Fixed compact height (`h-9` or similar), `border-t border-border`
- Leading: settings `PanelToolButton` with `Settings` icon (lucide), label "Settings"
- Trailing: reserved empty area for future status content
- Remove placeholder "Bottom Panel" text

### `ShellSettingsSheet` (new)

Opens from the bottom-panel settings button.

**UI primitive:** add `src/components/ui/sheet.tsx` following existing `@base-ui/react` + shadcn patterns used by `button.tsx` and `tooltip.tsx`. Sheet slides from the right edge on desktop.

**Sections:**

1. **Appearance**
   - Light / Dark segmented control
   - Wired to `useThemeStore.setMode` (`ThemeMode = "light" | "dark"`)
   - Does not add "system" theme in v1 (type is binary today)

2. **Panels**
   - "Show left panel" switch → `leftVisible` (add `setLeftVisible` to `shellStore` or call `toggleLeft` only when state differs)
   - "Show right panel" switch → `rightVisible`
   - "Reset panel widths" button → new `resetPanelWidths()` resetting `leftPanelWidth` and `rightPanelWidth` to `DEFAULT_SHELL_PANEL_WIDTH` without touching `activeMainCard` or visibility

Sheet state (`open`) is ephemeral React state in `ShellBottomPanel` or `ShellSettingsSheet` — not persisted.

## State changes

### `shellStore.ts`

Add:

```ts
setLeftVisible: (visible: boolean) => void;
setRightVisible: (visible: boolean) => void;
resetPanelWidths: () => void;
```

`resetPanelWidths` sets both widths to `DEFAULT_SHELL_PANEL_WIDTH`; does not call `resetShellUi`.

Persist keys unchanged (`leftVisible`, `rightVisible`, widths, `activeMainCard`).

## Component / file map

| Action | File |
| --- | --- |
| Modify | `src/modules/shell/ui/shellScreen.tsx` — single-row grid, remove mode bar |
| Delete | `src/modules/shell/ui/shellModeBar.tsx` |
| Add | `src/modules/shell/ui/shellCenterColumn.tsx` |
| Add | `src/modules/shell/ui/shellMainCardTabs.tsx` |
| Add | `src/modules/shell/ui/shellPanelToggle.tsx` |
| Add | `src/modules/shell/ui/panels/shellLeftPanelHeader.tsx` |
| Add | `src/modules/shell/ui/panels/shellRightPanelHeader.tsx` |
| Add | `src/modules/shell/ui/shellSettingsSheet.tsx` |
| Modify | `src/modules/shell/ui/panels/shellLeftPanel.tsx` — add header |
| Modify | `src/modules/shell/ui/panels/shellRightPanel.tsx` — add header |
| Modify | `src/modules/shell/ui/panels/shellBottomPanel.tsx` — settings trigger |
| Modify | `src/modules/shell/ui/panels/shellMainPanel.tsx` — drop side borders if center column owns chrome |
| Modify | `src/modules/shell/state/shellStore.ts` — visibility setters + `resetPanelWidths` |
| Add | `src/components/ui/sheet.tsx` — sheet primitive |
| Modify | `src/modules/shell/CONTEXT.md` — update Mode Bar / Bottom Panel terminology |
| Modify | `src/modules/shell/ui/shellScreen.test.tsx` — updated toggle selectors |

## Testing

### Update `shellScreen.test.tsx`

| Test | Change |
| --- | --- |
| Main cards stay mounted | Unchanged behavior; tab buttons now in center column |
| Hide left/right independently | Click `Hide left panel` / `Show left panel` (aria-label from `ShellPanelToggle`) instead of "Toggle left" |
| Resize left/right | Unchanged |

### New tests

| File | Cases |
| --- | --- |
| `shellPanelToggle.test.tsx` | Renders correct icon/label for open vs closed; calls correct store action |
| `shellSettingsSheet.test.tsx` | Opens sheet from settings button; theme switch calls `setMode`; panel switches update store; reset widths restores defaults |

### Manual verification

- [ ] Left toggle in panel header when open; moves to tab bar when closed (and vice versa)
- [ ] Right toggle symmetric
- [ ] Center column tabs switch main cards; inactive cards stay mounted
- [ ] Bottom panel spans center column only (not under sidebars)
- [ ] Settings sheet opens; theme change applies immediately
- [ ] Panel width reset works; visibility toggles in settings match panel state
- [ ] Panel resize still works when visible
- [ ] Shell UI state persists across reload

## Out of scope

- Right panel real content
- Bottom panel status/log content beyond settings trigger
- System theme mode
- Keyboard shortcuts for panel toggle
- Mobile / narrow-window responsive sheet behavior beyond basic usability

## Migration / rollout

No data migration. Persisted `shell` store shape is backward compatible (additive methods only). Users with saved panel visibility/widths keep them.
