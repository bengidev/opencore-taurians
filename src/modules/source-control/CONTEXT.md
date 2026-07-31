# Source Control App Context

## Owns

- Typed frontend contracts for native Git task-level commands and events.
- Revision-safe repository snapshots and operation progress.
- Source-control right-panel domain policy and UI.

## Boundaries

- Native Git process execution, checkout validation, mutations, and provider HTTP belong in `src-tauri/`.
- This module never accepts or constructs arbitrary executable, shell, environment, or Git argument input.
- Persisted right-panel feature and checkout restore metadata belong to the Project module.
- Global right-panel visibility and width belong to the Shell module.
