# Rust-first desktop boundary; frontend UI only

## Status

Accepted

## Context

OpenCore Taurians is a Tauri desktop app. Capabilities that touch the filesystem, OS shell, processes, or hardware should stay auditable, scoped, and consistent across macOS, Windows, and Linux. Letting feature code call Tauri plugins or web APIs directly from React spreads permission scope and duplicates validation.

## Decision

1. **Rust-first** — Implement native and I/O behavior in `src-tauri` as Tauri commands (grouped in Desktop services). Validate paths, enforce project/workspace scope, and perform mutations in Rust.
2. **Frontend UI only** — React modules render UI, hold view state, and call typed `invoke` wrappers. They subscribe to Desktop-emitted events for watchers, drag-drop completion, and similar push updates.
3. **No new direct I/O from feature modules** — Do not introduce `@tauri-apps/plugin-fs` or ad hoc filesystem access in `src/modules/*`. New features get a `*Api` layer that maps to commands.
4. **Whenever possible** — Default to this split for all new work. Legacy ports (`session` persist store, window controller, folder dialog) may still use plugins from thin infrastructure until explicitly migrated.

## Consequences

- **Positive:** Single place for path scoping, trash, copy, watchers, and cross-platform quirks; smaller frontend bundles; easier security review in `capabilities/`.
- **Positive:** Tests can mock at the `invoke` boundary in Vitest while Rust gets integration/unit tests for commands.
- **Negative:** More Rust code and command boilerplate than plugin-fs-from-TypeScript.
- **Negative:** Short-term inconsistency until legacy plugin call sites are migrated.

## Examples

| Feature | Desktop | Frontend |
| ------- | ------- | -------- |
| File explorer | `explorer_list_dir`, `explorer_trash`, `explorer_watch`, … | `ExplorerTree`, `explorerStore`, `explorerApi` |
| Open folder (target) | Dialog or `explorer_pick_folder` command | Button triggers API only |
| Editor open/save file | `editor_read_file`, `editor_write_file`, `editor_create_file`, `editor_read_external_file`, `editor_is_under_root`, `editor_paths_include_directory` | `EditorPanel`, `editorStore`, `editorApi` |
