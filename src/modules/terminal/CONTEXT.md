# Terminal

Terminal sessions for project trunks: an xterm-based main card that spawns a PTY-backed shell through Desktop commands and streams output/exit back over a Tauri channel.

## Language

**Terminal Card**:
The main-card view that renders an interactive xterm terminal for the active project trunk. It owns the xterm instance, Fit/WebLinks addons, and the app-themed color palette, and drives the terminal store and API from the shell's main card stack.
_Avoid_: Terminal view, terminal tab, console (when referring to this component specifically)

**Terminal Session**:
A live PTY process (system default shell) spawned for a specific project trunk, tracked in the terminal store by `trunkId`. Sessions buffer output until ready and emit exit events when the process ends.
_Avoid_: Terminal, process, shell instance (when referring to the running process)

**Trunk-bound session**:
The mapping from a project trunk (`activeTrunkId`) to its terminal session entry. The store keys sessions by `trunkId`; switching trunks switches the active terminal, and each trunk keeps its own session.
_Avoid_: Tab, workspace terminal, per-project terminal

## Architecture

UI-only frontend: the module renders xterm and delegates PTY ownership to Desktop. See [ADR-0001](../../../src-tauri/docs/adr/0001-rust-first-desktop-boundary.md).

- **UI** (`ui/`) — `TerminalCard` builds and drives the xterm instance; `TerminalPlaceholder` renders when no project trunk is active.
- **State** (`state/`) — `terminalStore` keeps `sessionsByTrunkId`, buffering channel output in `pendingMessages` until a session is `ready`, then drains it. Setters never leave a partial entry behind, so a missing key defaults before `ensureSession`.
- **API** (`api/`) — `terminalApi` wraps Desktop `terminal_*` commands and the Tauri `Channel`; `terminalContracts` defines the shared input/result/message types and public errors.

The Rust side owns the PTY: `session.rs` spawns the system default shell, `registry.rs` holds live sessions, `commands.rs` exposes `terminal_spawn` / `terminal_write` / `terminal_resize` / `terminal_get_size` / `terminal_kill`. Output streams to the webview as `TerminalChannelMessage` (`Output` base64 chunks, `Exit` events) over a single channel passed at spawn time; exit/error handling follows the `PublicTerminalError` contract.

Never implement PTY, process, or shell logic in React — the frontend only renders xterm state and calls the API.
