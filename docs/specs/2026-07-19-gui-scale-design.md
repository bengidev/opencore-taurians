# GUI scale — design

Date: 2026-07-19  
Branch / worktree: `feat/gui-scale`  
Status: approved for implementation planning

## Goal

Add a **GUI scale** setting so the entire OpenCore UI (onboarding, workspace popup, and shell) can scale from **50% to 200%**. When scaled content would exceed the default window for the current mode, the app **resizes the window** so UI is not chopped. When scale decreases, the window **shrinks back** toward the scaled base size. The slider cannot request a scale that will not fit on the current monitor.

## Decisions

| Topic | Choice |
| --- | --- |
| Range | 50%–200% (`0.5`–`2.0`), default `1.0` (100%) |
| Scaling technique | CSS `zoom` on the session/app root |
| Window behavior | Tracks scale both ways: `baseSize × scale` |
| Monitor overflow | Cap window to work area; **clamp slider max** so invalid scales cannot be chosen |
| Scope | App-wide (not shell-only) |
| Persistence | Persist scale across restarts and restore zoom + window size on hydrate |

## Architecture

### Preferences

- Persist `guiScale: number` (default `1`) on the **session store** (app-wide preference, not shell-only chrome). Settings and the root applicator both read/write this single field.
- On hydrate / reset: invalid values clamp into `[0.5, maxFit]`; full session reset restores `1.0`.

### Scale applicator

- Apply CSS `zoom: <guiScale>` on the top-level session root so onboarding, workspace popup, and shell all scale together.
- Re-apply whenever `guiScale` changes and on hydrate when the app is already past the loading gate.

### Window sizing

- Base sizes remain:
  - Onboarding: `ONBOARDING_WINDOW_SIZE` (960×680)
  - Shell: `SHELL_WINDOW_SIZE` (1280×800)
- Effective size: `round(base.width × scale)` × `round(base.height × scale)`, then clamp so both dimensions fit the current monitor **work area**.
- Extend `sessionWindowController` so onboarding and shell apply paths accept the current scale (or read it from the preference store) and center after resize.
- Mode transitions (onboarding ↔ shell) keep the same `guiScale` and resize to that mode’s scaled base.

### Max fit / slider clamp

- `maxFit = min(2.0, workArea.width / base.width, workArea.height / base.height)` using the **active** mode’s base size.
- Slider range: min `0.5`, max `maxFit` (never above `2.0`).
- If the display changes (or work area shrinks) and stored scale exceeds `maxFit`, clamp the stored value, re-apply zoom, and resize.

## Settings UI

- Location: Settings → **Appearance**.
- Control: labeled **GUI scale**, with a slider and a live percentage label (e.g. `125%`).
- Step: **5%** (`0.05`).
- Changing the slider updates preference → zoom → window resize immediately.

## Data flow

```
Settings slider / hydrate / display change
        │
        ▼
   guiScale preference (clamped)
        │
        ├──► CSS zoom on session root
        └──► WindowController.apply*(scale)
                 └──► base × scale → work-area clamp → setSize + center
```

## Edge cases

- **Manual user resize:** the next scale change snaps the window back to `base × scale` (scale owns size while adjusting).
- **Tauri resize / monitor query failure:** keep zoom applied; leave window unchanged; do not block settings.
- **Onboarding vs shell:** scale always applies; only the base window size changes with mode.
- **Reset persisted data:** `guiScale` returns to `1.0` and window returns to the current mode’s default base size.

## Components (implementation sketch)

1. Session-store `guiScale` + clamp helpers for `guiScale` / `maxFit`.
2. Root zoom applicator wired to the preference.
3. Window controller scale-aware apply methods + work-area query.
4. Settings Appearance row (Slider + label).
5. Tests for clamp/persist, size math (both bases), settings interaction, and hydrate re-apply (using the memory window controller where possible).

## Testing

- Unit: clamp into `[0.5, maxFit]`; size math for onboarding and shell bases; work-area clamp.
- Store: persist and rehydrate `guiScale`.
- UI: Settings slider updates scale and shows percentage.
- Window controller (memory): scaled onboarding and shell sizes; clamp behavior covered by pure helpers where OS APIs are unavailable in tests.

## Out of scope

- Per-monitor different saved scales.
- Independent zoom for shell chrome vs content.
- Changing default base sizes (`960×680` / `1280×800`) themselves.
- Non-zoom scaling strategies (`transform: scale`, rem-only).

## Success criteria

1. Settings exposes **GUI scale** from 50% up to the lesser of 200% and what fits on screen.
2. All primary UI surfaces scale together.
3. Window grows and shrinks with scale so content is not clipped by the default window.
4. Scale survives restart and restores correctly after hydrate.
