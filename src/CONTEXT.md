# App

React 19 frontend: module boundaries, shared UI, routing between session surfaces, and typed bridges to Desktop.

## Language

**App**:
The `src/` tree — feature modules under `src/modules/`, shared components, and the session root. Runs inside the Tauri webview.
_Avoid_: Frontend (when ambiguous with “frontend build”), client, web app (in domain docs)

**Feature Module**:
A bounded area under `src/modules/<name>/` with domain types, state, UI, and an `index.ts` public seam. Examples: `project`, `shell`, `session`.
_Avoid_: Package, plugin, widget library

**Infrastructure Port**:
A thin adapter in `infrastructure/` (e.g. folder picker, window controller, persist storage) that hides Tauri or test doubles. UI and domain code depend on the port, not on `@tauri-apps/*` directly.
_Avoid_: Service layer, repository, gateway (unless already used in that module)

## Architecture

**UI-only frontend** — Desktop owns native and I/O. See [`src-tauri/CONTEXT.md`](../src-tauri/CONTEXT.md) and [ADR-0001](../src-tauri/docs/adr/0001-rust-first-desktop-boundary.md).

Feature modules:

- **UI** (`ui/`) — components, layout, user input, accessibility.
- **State** (`state/`) — Zustand stores for view state and selections; no filesystem or OS calls.
- **Domain** (`domain/`) — pure TypeScript rules and types.
- **API** (`api/` or `infrastructure/*Api.ts`) — `invoke` wrappers and event subscriptions to Desktop commands.

When adding capabilities (file explorer, terminal, editor I/O, etc.), add Rust commands first, then wire the module through an API layer. Do not implement filesystem or process logic in React.
