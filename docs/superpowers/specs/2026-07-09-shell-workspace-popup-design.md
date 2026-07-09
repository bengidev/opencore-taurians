# Shell & Workspace Popup Design

**Date:** 2026-07-09  
**Status:** Approved  
**Scope:** Session orchestration, shell base layout, workspace popup gate, Zustand state, Tauri persistence, Nothing visual language

## Problem

After onboarding, the app shows a placeholder. Users need a VS Code-like shell as the base surface, a workspace popup when no folder is open, restored UI state on relaunch, and a debug path to wipe persisted data and re-walk the flow.

## Goals

- Shell as the base panel; left, right, main, and bottom panels compose on top of it
- Workspace popup when no workspace folder is selected; dismiss only after a real folder pick
- Persist and restore: onboarding completion, theme, workspace path, shell UI state
- Window sizes: onboarding **960×680**, shell **1280×800**, re-center on transition
- Internal modules with public seams; abstractions hide implementations
- Zustand for state; Tauri Store for persistence; TDD; Nothing design + 6px technical buttons
- Floating debug control resets all persisted app data

## Non-goals

- Real chat, terminal, or editor functionality
- Working New file / Clone repository / Open command palette actions
- Populated recent-projects list
- Standalone npm packages for these modules
- Design references outside this repository at runtime

## Architecture

### Approach

Layered internal modules with ports (Repository / WindowController / FolderPicker). Zustand stores per concern. Persistence via Zustand `persist` with a custom Tauri Store storage adapter. Session module orchestrates screens, window sizing, and debug reset.

### Modules

| Module | Owns | Public seam |
| --- | --- | --- |
| `session` | Screen routing (onboarding ↔ shell), window size/recenter, boot hydration, debug reset | `SessionRoot`, reset control, session ports as needed for tests |
| `shell` | Base layout; left/right/main/bottom as **internal** panel units; main-card swap | `ShellScreen` |
| `workspace-popup` | Welcome/workspace gate UI; Open project action | `WorkspacePopup` |
| `onboarding` | Existing welcome screen; theme store (Zustand) | Existing exports; thinner internals |

Layout under `src/modules/`:

```
session/           # domain, state, infrastructure ports, SessionRoot, debug reset UI
shell/             # ShellScreen, internal panels/, shellStore
workspace-popup/   # WorkspacePopup, folder-picker usage via port
onboarding/        # existing; theme → Zustand; completion owned by session
```

Each module exposes only `index.ts`. Callers do not import deep paths. Domain, infrastructure, and UI stay inside the module.

### Zustand stores

| Store | State | Key actions |
| --- | --- | --- |
| `sessionStore` | `onboardingCompleted`, boot/hydration status | `completeOnboarding`, `resetAll` |
| `workspaceStore` | `workspacePath: string \| null` | `setWorkspace`, `clearWorkspace` |
| `shellStore` | `activeMainCard` (`chat` \| `terminal` \| `editor`), `leftVisible`, `rightVisible` | setters / toggles |
| `themeStore` (onboarding module) | theme mode | toggle / set (refactor from React context) |

Stores are colocated inside their owning module (`state/` or `domain/`). No god store. `resetAll` in session clears every persisted key this app owns and resets in-memory stores.

The shared Zustand↔Tauri Store storage adapter lives in `session/infrastructure` and is the only production persistence backend. Other modules’ `persist` configs receive that adapter (or a test fake) via injection / shared factory exported for store setup — not by importing Tauri APIs directly.

### Ports (implementations inside modules)

| Port | Owner module | Responsibility | Production adapter |
| --- | --- | --- | --- |
| `FolderPicker` | `workspace-popup` | Pick a directory | Tauri dialog |
| `WindowController` | `session` | Resize and center the window | Tauri window API |
| `PersistedStore` / storage adapter | `session` | Durable key/value behind Zustand storage | Tauri plugin-store |

Tests use fakes for all three.

### App composition

`App.tsx` mounts `ThemeProvider` (thin adapter over Zustand if kept) and `SessionRoot`. Session decides onboarding vs shell. Shell always mounts after onboarding; `WorkspacePopup` overlays shell when `workspacePath` is null.

## User flows

### Cold start — first run

1. Hydrate stores from Tauri Store.
2. `onboardingCompleted === false` → show onboarding at **960×680**, centered.
3. User Enter → `completeOnboarding()` → persist → resize/center to **1280×800** → show shell.
4. No workspace path → modal workspace popup over shell.
5. User **Open project** → folder dialog → path saved → popup dismisses.
6. Shell shows with dummy panels; UI toggles persist.

### Cold start — returning user with workspace

1. Hydrate stores.
2. Onboarding skipped; shell at **1280×800** with last `shellStore` state.
3. Popup does not show.

### Cold start — returning user without workspace

1. Hydrate; onboarding skipped; shell + workspace popup.

### Debug reset

1. Floating control clears Tauri Store keys for this app and resets all Zustand stores (onboarding completion, theme, workspace path, shell UI).
2. Window resizes/recenters to **960×680**.
3. Onboarding shows again.

## UI surfaces

### Shell (1280×800)

- Top mode bar: `chat` | `terminal` | `editor` (segmented, Space Mono labels, 6px radius controls)
- Columns: left panel | main panel | right panel
- Bottom panel full width
- Left and right visibility independent via `shellStore`
- Main cards stay mounted and hidden when inactive so React state survives swaps
- Dummy labeled content only (titles + sample text)

### Workspace popup (modal over shell)

- Dimmed shell behind; centered popup content
- Logo: dark and light PNGs copied into `public/brand/opencore-logo-dark.png` and `public/brand/opencore-logo-light.png` (imported once from the designer asset set; runtime uses only these repo paths)
- Copy: “Welcome back to” / **OPENCORE** / “Pick up where you left off or start something new”
- Get started: New file, Open project, Clone repository, Open command palette
- Only **Open project** is live; others visible and inert (`aria-disabled` / no handler)
- Recent projects: placeholder only
- No dismiss without a selected workspace

### Onboarding

- Existing Nothing onboarding screen
- Enter drives session completion + window transition
- Default window config **960×680** (update `tauri.conf.json` from 960×720)

### Debug reset control

- Always available floating control in session chrome
- Clears all persisted data listed under Goals

## Visual language (Nothing)

Applies to shell, workspace popup, and session chrome (onboarding already aligned).

- **Fonts:** Space Grotesk (UI/body), Space Mono (labels/data, ALL CAPS), Doto for hero moments only. Max 2 families, 3 sizes, 2 weights per screen.
- **Surfaces:** OLED black / paper light; gray-scale hierarchy; borders over shadows/blur; no chrome gradients.
- **Accent red:** interrupt only, not decorative.
- **Controls:** technical **6px** rounded rectangles; no capsules / `rounded-full` for actions or mode tabs. Shared `Button` stays at `rounded-[6px]`.
- **Popup hierarchy:** primary = brand/logo + OPENCORE; secondary = welcome + get-started; tertiary = recent projects. One compositional break.
- **Shell:** structure-as-ornament — flat bordered panel grid; active card via text/border contrast.
- **Motion (with emil-design-eng, Nothing-compatible):** button press `scale(0.97)` ~160ms ease-out; popup enter `scale(0.95)` + opacity ~200–250ms ease-out; no `scale(0)`; no spring/bounce; high-frequency card swap / panel toggle instant or near-instant; no animation on keyboard-driven actions; respect `prefers-reduced-motion`.
- **Status:** inline `[ERROR: …]` / `[LOADING...]` — no toasts.

## Data & errors

### Persistence

Zustand `persist` + custom storage adapter backed by Tauri plugin-store. Keys cover: onboarding completed, theme, workspace path, shell UI state.

### Errors

| Case | Behavior |
| --- | --- |
| Folder dialog cancel | No state change; popup stays |
| Folder dialog / store I/O failure | Inline status; no toast |
| Hydration failure | Safe defaults (onboarding incomplete, no workspace, default shell UI); optional inline debug status |

## Refactor scope

- Replace `App` `useState(entered)` with `sessionStore.onboardingCompleted`
- Theme: React context → Zustand; keep `useTheme` / `ThemeProvider` as thin public adapters
- `tauri.conf.json` default window → 960×680
- Add Tauri plugins: `store`, `dialog`; update capabilities
- Copy logo assets into `public/brand/` as above; runtime must not read paths outside the repo

## Testing (TDD)

- Store actions with fake storage (no Tauri)
- Port fakes: `FolderPicker`, `WindowController`, `PersistedStore`
- UI: popup when no path; Open project success dismisses; card swap keeps mounted state; left/right independent; reset returns to onboarding and clears persistence

## Delivery constraints

- English language
- Internal modules only (not standalone packages)
- Software design principles and patterns (ports/adapters, public seams, store slices)
- TDD; subagents for parallel implementation slices; granular commits
- Product UI and module docs refer only to in-repo paths and names

## Open decisions (resolved)

| Decision | Choice |
| --- | --- |
| Module split | Hybrid: `shell` + `workspace-popup`; panels internal to shell |
| Workspace selection | Real folder path via Tauri dialog |
| Main cards | Labeled placeholders; preserve mounted state |
| Debug reset | Wipe all feature persistence including theme |
| Persistence backend | Tauri Store (via Zustand persist adapter) |
| Popup actions | Only Open project live |
| Popup placement | Modal overlay on shell |
| Orchestration | `session` module |
| State management | Zustand |
| Visual system | Nothing design; 6px technical buttons |
