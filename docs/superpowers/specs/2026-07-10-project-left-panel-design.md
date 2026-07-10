# Project left panel (t3code-like) — Design

Date: 2026-07-10  
Status: Approved for implementation planning

## Goal

Replace the shell left-panel placeholder with a t3code-like project navigator: opened-project history, nested work units, chat history, organization (pin/group/search), retention, and per-work-unit restore of the last main card (chat / terminal / editor).

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Scope | Near-parity with t3code sidebar (pin, groups, nested children, search, drag-reorder, status where real signals exist) |
| Work unit name | `ProjectChunk` (nested tree under a project) |
| Project ↔ workspace | Project wraps folder path + history; `workspacePath` is derived from the active Project |
| Child chunks | True nesting via `parentChunkId` |
| Grouping | Auto-group by parent directory of `folderPath` + manual group overrides |
| Chat history | Full message persistence in v1 |
| Retention | Inactive projects, chunks, and chat eligible after 30 days; **pinned never auto-deletes** |
| Pin targets | Both projects and chunks |
| Search | Names (projects/chunks/groups) + chat message bodies |
| Existing workspace | Auto-migrate: one Project + one root `ProjectChunk` |
| Architecture | Split early: `project` module + `chat` module |

## Architecture & module boundaries

### `project` (`src/modules/project/`)

Owns:

- `Project`, `ProjectChunk` (tree), manual `ProjectGroup`, auto-group derivation
- Pin, search orchestration, retention sweeper
- Per-chunk UI restore state (`activeMainCard`)
- Left-panel UI

Naming: files and types use the `project` / `Project` prefix (e.g. `projectStore.ts`, `ProjectChunk`, `projectLeftPanel.tsx`).

### `chat` (`src/modules/chat/`)

Owns:

- Message model and persistence keyed by `ProjectChunk` id
- APIs used by project: load by chunk, append, search message bodies, delete by chunk ids

Naming: `chat` / `Chat` prefix (e.g. `chatStore.ts`, `ChatMessage`).

Does **not** own the left panel.

### `shell`

- Hosts the left-panel slot; renders the project panel component
- Keeps layout chrome (visibility, resize)
- Does not own project history

### `workspace-popup` / app `session`

- Opening a folder creates or activates a Project (and ensures a root chunk)
- App `session` remains lifecycle-only (onboarding/boot/hydration) — not a `ProjectChunk`

### Retention ownership

- `project` runs the 30-day sweeper and decides what is expired
- Chat cleanup goes through `chat.deleteByChunkIds(...)`
- Pinned projects and pinned chunks are exempt from auto-delete

## Data model

### Project

- `id`, `name`, `folderPath`, `pinned`, `createdAt`, `lastOpenedAt`
- `manualGroupId?` — when set, manual group wins over auto-group placement

### ProjectChunk

- `id`, `projectId`, `parentChunkId: string | null`, `title`, `pinned`
- `createdAt`, `lastOpenedAt`
- `restore: { activeMainCard: "chat" | "terminal" | "editor" }`
- Root chunks use `parentChunkId: null`; children nest under a parent

### ProjectGroup (manual)

- `id`, `label`, `projectIds[]`, `order`
- Auto groups are computed at read time; not the sole stored grouping source
- **Auto-group rule (v1):** group by immediate parent directory of `folderPath` (label = parent folder name). Same-name parents from different locations stay separate (key = parent path). Git remote–based grouping is out of scope for v1.

### ChatMessage (`chat` module)

- `id`, `chunkId`, `role: "user" | "assistant" | "system"`, `content`, `createdAt`
- Full ordered history per chunk

### Activity & retention rules

- “Used” means: project/chunk opened or selected, or a new chat message on that chunk
- Activity stamps: selecting a chunk updates that chunk’s and its project’s `lastOpenedAt`; a new chat message updates that chunk’s and its project’s `lastOpenedAt`
- Auto-delete candidates: unpinned chunks with `lastOpenedAt` older than 30 days; unpinned projects with `lastOpenedAt` older than 30 days **and** no pinned chunk remaining in their tree
- A pinned chunk is never auto-deleted; its ancestor project is also retained while that pinned chunk exists (even if the project itself is unpinned and stale)
- Nesting depth: unlimited in the data model; UI may virtualize long trees
- Deleting a project deletes its chunk tree and all linked chat messages
- Deleting a chunk deletes its subtree and linked chat messages

### Search

- `project` matches titles and group labels
- `chat.searchMessages(query)` returns chunk ids (and optional snippets)
- `project` merges/ranks results: title matches first, then message hits

## Left panel UI & interactions

### Layout

1. Header — search + actions (new project / new chunk)
2. Pinned section — pinned projects; pinned chunks shown under their project
3. Grouped project list — auto groups + manual groups; ungrouped remainder
4. Per project — expandable `ProjectChunk` tree
5. Footer utilities — optional later; not required for v1 beyond needed chrome

### Behaviors

- **Select chunk** — activate its project (derive workspace), restore that chunk’s last main card, load its chat
- **Select project** — expand/collapse; if no active chunk, activate last-opened root chunk
- **Pin / unpin** — project or chunk
- **Add child chunk** — nested child under the selected chunk
- **New root chunk** — under a project
- **Drag-reorder** — projects within a group / manual membership; sibling chunks under the same parent
- **Manual delete** — confirm; no separate archive store in v1
- **Status** — active selection highlight only in v1; no unread/agent provider pills until those signals exist

### Empty / first-run

- Migrated workspace → one project + one root chunk selected
- No projects → CTA to open folder (reuse workspace popup / folder picker)

## Data flow

### Boot / hydrate

1. Rehydrate `project` + `chat` stores (new persist keys beside existing session keys)
2. One-time migrate: if `workspacePath` exists and projects are empty → create Project + root `ProjectChunk`, set active, stamp `lastOpenedAt`
3. Run retention sweep
4. Shell left panel mounts project UI; chunk activation applies `restore.activeMainCard`

### Open folder

Picker → find-or-create Project by `folderPath` → ensure root chunk → set active → derive workspace for shell.

### Chunk click

Set active project + chunk → bump `lastOpenedAt` → apply restore card → chat loads messages for `chunkId`.

### Leaving a view

When shell `activeMainCard` changes while a chunk is active, write back to that chunk’s `restore.activeMainCard`.

### Delete / retention / debug reset

- Manual delete and sweeper share the same cascade path (chunk subtree → chat delete → project removal when applicable)
- `resetAllPersistedSession` also clears project + chat persist keys

### Persistence shape

Prefer separate persist keys (not one monolithic blob), e.g.:

- `opencore-project` — projects, chunks, groups, active ids, UI prefs
- `opencore-chat` — messages by chunk

Reuse the existing session persist storage adapter (Tauri store in production, memory in tests).

### Workspace sync

- `workspace-popup`’s `workspacePath` remains the shell/boot gate for “has a folder open”
- Active Project is source of truth for which folder is open: activating a project/chunk writes `folderPath` into `workspacePath`
- Migrate and open-folder flows must keep these two aligned; clearing workspace (debug reset) clears project/chat too

## Error handling

- Persist write failures: keep last good in-memory state; non-blocking panel error
- Missing folder on disk: keep project listed; recoverable re-link via folder picker
- Search/chat load failures: inline empty/error; do not wipe stores

## Testing

- Unit: chunk tree ops, pin exemption, retention cutoff, workspace migrate, search ranking merge, restore writeback
- Component: left panel select/expand/pin/delete/search; shell hosts panel
- Integration: project/chunk delete cascades to chat; debug reset clears project + chat

## Out of scope (v1)

- Separate archive store (delete is permanent from the product model)
- Fake t3code provider/agent status pills without real runtime signals
- Extracting chat UI beyond what restore + history require (composer richness can stay thin if messages persist)
- Remote/multi-environment project grouping (t3code env presence) — local folder projects only
- Git remote–based auto-grouping (parent-directory auto-group only in v1)

## Success criteria

- Left panel lists projects/chunks with pin, groups (auto + manual), nested children, search (names + messages), drag-reorder
- Opening a chunk restores last chat/terminal/editor card and loads that chunk’s messages
- History auto-deletes after 30 days of inactivity unless pinned; manual delete works
- Existing `workspacePath` users migrate into one Project + root chunk on first boot
- `workspacePath` remains consistent with the active Project’s `folderPath`
`}