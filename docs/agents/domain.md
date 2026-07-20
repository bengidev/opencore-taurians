# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. Also check context-scoped `docs/adr/` directories from the context map.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Multi-context layout for this repo:

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                              ← system-wide decisions
├── src/
│   ├── CONTEXT.md                         ← app: UI-only frontend, module layout
│   ├── docs/adr/
│   └── modules/
│       ├── onboarding/
│       │   ├── CONTEXT.md
│       │   └── docs/adr/
│       ├── session/CONTEXT.md
│       ├── shell/CONTEXT.md
│       ├── workspace-popup/CONTEXT.md
│       ├── project/CONTEXT.md
│       ├── chat/CONTEXT.md
│       └── explorer/CONTEXT.md
└── src-tauri/
    ├── CONTEXT.md                         ← desktop: Rust-first, commands, native I/O
    └── docs/adr/
        └── 0001-rust-first-desktop-boundary.md
```

## Context guide

| Context | When to read |
| ------- | ------------ |
| **onboarding** | Onboarding Screen, Theme Mode (default light), Galaxy Orb, Scene Backdrop, Enter action |
| **session** | Session lifecycle, persistence, boot hydration, root UI, window sizing, GUI scale |
| **shell** | Workspace chrome, Main Cards, panels, Settings (theme / GUI scale / explorer auto-refresh), Main Card Tabs |
| **workspace-popup** | Workspace Popup, Open Project, Folder Picker |
| **project** | Projects, ProjectTrunks, ProjectGroups, activation, retention |
| **chat** | ChatMessage persistence and trunk-scoped history |
| **explorer** | Explorer, Explorer Panel, Explorer Tree, live / on-activate auto-refresh |
| **app** | `App.tsx`, routing, shared components, design-system integration |
| **desktop** | Tauri config, Rust commands, window management, native plugins |

## Rust-first / UI-only boundary

Read **`src-tauri/CONTEXT.md`**, **`src/CONTEXT.md`**, and **`src-tauri/docs/adr/0001-rust-first-desktop-boundary.md`** before adding features that touch the filesystem, OS, or processes.

- **Desktop (Rust):** commands, validation, watchers, drag-drop handling, trash, and other native I/O.
- **App (React):** UI, view state, typed `invoke` wrappers, and event listeners — not direct `@tauri-apps/plugin-fs` or filesystem logic in feature modules.
- **Whenever possible** applies to all new work; legacy session ports using Tauri plugins are exceptions until migrated.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
