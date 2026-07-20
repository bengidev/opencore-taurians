# Desktop

Tauri 2 backend: Rust commands, native integrations, filesystem and OS boundaries, and events to the webview.

## Language

**Desktop**:
The `src-tauri` crate — plugins, commands, and Rust services that own platform capabilities. The React app calls into Desktop; Desktop does not render UI.
_Avoid_: Backend (when ambiguous with AI providers), native layer, Rust side (in user-facing copy)

**Tauri Command**:
A `#[tauri::command]` handler exposed to the frontend via `invoke`. The primary integration surface for capabilities that touch the OS, filesystem, or long-running work.
_Avoid_: API endpoint, RPC, IPC handler (in domain docs)

**Desktop Service**:
A Rust module (e.g. `explorer/`) grouping related commands, validation, and side effects (watchers, drag-drop). One service per feature area with a clear root path scope.
_Avoid_: Plugin, crate, subsystem (when referring to these modules specifically)

## Architecture

**Rust-first boundary** — see [ADR-0001](docs/adr/0001-rust-first-desktop-boundary.md).

Whenever a feature needs filesystem access, process execution, OS integration, watchers, or other native capability, implement it in Desktop as commands and events. The frontend is UI only: render state, call `invoke`, listen for events, map errors to UX.

Do not add new direct capability usage from TypeScript (e.g. `@tauri-apps/plugin-fs` in feature modules). Prefer a typed `*Api` module in the frontend that wraps Desktop commands.

Existing session infrastructure (store, window resize, folder dialog) may still use Tauri plugins from thin ports until migrated; new work does not extend that pattern.
