# Project Left Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a left-panel project navigator with nested `ProjectChunk`s, pinned/grouped/searchable history, 30-day retention, full chat message persistence, and per-chunk restore of the last main card.

**Architecture:** New `chat` module owns message persistence keyed by chunk id. New `project` module owns projects, chunk trees, groups, retention, search orchestration, activation (workspace + shell restore), and the left-panel UI. Shell hosts the panel; workspace popup and session boot migrate/sync `workspacePath` from the active project. Prefer pure domain helpers + Zustand stores on the existing session persist adapter.

**Tech Stack:** React 19, Zustand persist, Vitest + Testing Library, Tauri store via `createSessionPersistStorage`, Tailwind/shadcn `Button`, lucide-react icons. No new drag library — HTML5 drag-and-drop for sibling reorder.

**Spec:** `docs/superpowers/specs/2026-07-10-project-left-panel-design.md`

---

## File structure

### Create — `chat`

| File | Responsibility |
| --- | --- |
| `src/modules/chat/index.ts` | Public exports |
| `src/modules/chat/domain/chatTypes.ts` | `ChatMessage`, `ChatRole` |
| `src/modules/chat/state/chatStore.ts` | Persist messages; append/list/search/delete/reset |
| `src/modules/chat/state/chatStore.test.ts` | Store tests |

### Create — `project`

| File | Responsibility |
| --- | --- |
| `src/modules/project/index.ts` | Public exports (`ProjectLeftPanel`, activation helpers) |
| `src/modules/project/domain/projectTypes.ts` | `Project`, `ProjectChunk`, `ProjectGroup`, restore type |
| `src/modules/project/domain/projectPath.ts` | Basename + parent-dir helpers (POSIX/Windows) |
| `src/modules/project/domain/projectPath.test.ts` | Path helper tests |
| `src/modules/project/domain/projectChunkTree.ts` | Subtree ids, children, sibling reorder |
| `src/modules/project/domain/projectChunkTree.test.ts` | Tree helper tests |
| `src/modules/project/domain/projectAutoGroup.ts` | Parent-directory auto groups |
| `src/modules/project/domain/projectAutoGroup.test.ts` | Auto-group tests |
| `src/modules/project/domain/projectRetention.ts` | 30-day expiry selection (pin rules) |
| `src/modules/project/domain/projectRetention.test.ts` | Retention tests |
| `src/modules/project/domain/projectMigrate.ts` | Workspace → first project+chunk |
| `src/modules/project/domain/projectMigrate.test.ts` | Migrate tests |
| `src/modules/project/domain/projectSearch.ts` | Merge title + message hits |
| `src/modules/project/domain/projectSearch.test.ts` | Search merge tests |
| `src/modules/project/state/projectStore.ts` | Projects/chunks/groups/active ids + mutations |
| `src/modules/project/state/projectStore.test.ts` | Store + cascade tests |
| `src/modules/project/state/projectActivation.ts` | Activate chunk/project; restore writeback; open folder |
| `src/modules/project/state/projectActivation.test.ts` | Activation tests |
| `src/modules/project/ui/projectLeftPanel.tsx` | Left panel composition |
| `src/modules/project/ui/projectLeftPanel.test.tsx` | Panel interaction tests |
| `src/modules/project/ui/projectChunkTree.tsx` | Nested chunk list + DnD siblings |
| `src/modules/project/CONTEXT.md` | Domain language for project |

### Create — `chat` context

| File | Responsibility |
| --- | --- |
| `src/modules/chat/CONTEXT.md` | Domain language for chat |

### Modify

| File | Change |
| --- | --- |
| `src/modules/session/infrastructure/sessionPersistKeys.ts` | Add `project` + `chat` keys |
| `src/modules/session/state/sessionReset.ts` | Reset project + chat stores |
| `src/modules/session/state/sessionReset.test.ts` | Assert new keys cleared |
| `src/modules/session/ui/sessionRoot.tsx` | Rehydrate project/chat; migrate; retention sweep |
| `src/modules/workspace-popup/ui/workspacePopup.tsx` | Open folder → `openProjectFolder` |
| `src/modules/workspace-popup/ui/workspacePopup.test.tsx` | Expect project created |
| `src/modules/shell/ui/panels/shellLeftPanel.tsx` | Render `ProjectLeftPanel` |
| `src/modules/shell/ui/panels/shellMainPanel.tsx` | Thin chat message list for active chunk |
| `src/modules/shell/ui/shellScreen.test.tsx` | Left panel still labeled; project empty CTA ok |
| `CONTEXT-MAP.md` | Register `project` + `chat` contexts |

---

### Task 1: Persist keys for project and chat

**Files:**
- Modify: `src/modules/session/infrastructure/sessionPersistKeys.ts`
- Modify: `src/modules/session/state/sessionReset.test.ts` (will fully pass after Task 11; for now only extend keys expectation once reset is updated — do keys first)

- [ ] **Step 1: Extend persist keys**

Replace `SESSION_PERSIST_KEYS` with:

```ts
/** Zustand persist `name` values — keep in sync with resetAll. */
export const SESSION_PERSIST_KEYS = {
  session: "opencore-session",
  workspace: "opencore-workspace",
  shell: "opencore-shell",
  theme: "opencore-theme",
  project: "opencore-project",
  chat: "opencore-chat",
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/session/infrastructure/sessionPersistKeys.ts
git commit -m "Add project and chat session persist keys."
```

---

### Task 2: Chat types and store

**Files:**
- Create: `src/modules/chat/domain/chatTypes.ts`
- Create: `src/modules/chat/state/chatStore.ts`
- Create: `src/modules/chat/state/chatStore.test.ts`
- Create: `src/modules/chat/index.ts`

- [ ] **Step 1: Write failing store test**

Create `src/modules/chat/state/chatStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useChatStore } from "./chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useChatStore.setState({ messagesByChunkId: {} });
  });

  it("appends messages per chunk in order", () => {
    const a = useChatStore.getState().appendMessage({
      chunkId: "c1",
      role: "user",
      content: "hi",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const b = useChatStore.getState().appendMessage({
      chunkId: "c1",
      role: "assistant",
      content: "hello",
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    expect(useChatStore.getState().listMessages("c1").map((m) => m.id)).toEqual([
      a.id,
      b.id,
    ]);
  });

  it("searches message bodies case-insensitively", () => {
    useChatStore.getState().appendMessage({
      chunkId: "c1",
      role: "user",
      content: "Fix the Login bug",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      chunkId: "c2",
      role: "user",
      content: "unrelated",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const hits = useChatStore.getState().searchMessages("login");
    expect(hits.map((h) => h.chunkId)).toEqual(["c1"]);
    expect(hits[0]?.snippet.toLowerCase()).toContain("login");
  });

  it("deleteByChunkIds removes only those chunks", () => {
    useChatStore.getState().appendMessage({
      chunkId: "c1",
      role: "user",
      content: "a",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      chunkId: "c2",
      role: "user",
      content: "b",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().deleteByChunkIds(["c1"]);
    expect(useChatStore.getState().listMessages("c1")).toEqual([]);
    expect(useChatStore.getState().listMessages("c2")).toHaveLength(1);
  });

  it("resetChat clears all messages", () => {
    useChatStore.getState().appendMessage({
      chunkId: "c1",
      role: "user",
      content: "a",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().resetChat();
    expect(useChatStore.getState().messagesByChunkId).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/chat/state/chatStore.test.ts`

Expected: FAIL (module not found / `useChatStore` undefined)

- [ ] **Step 3: Implement types + store + barrel**

`src/modules/chat/domain/chatTypes.ts`:

```ts
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  chunkId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSearchHit {
  chunkId: string;
  messageId: string;
  snippet: string;
}
```

`src/modules/chat/state/chatStore.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";
import type { ChatMessage, ChatRole, ChatSearchHit } from "../domain/chatTypes";

export interface ChatState {
  messagesByChunkId: Record<string, ChatMessage[]>;
  appendMessage: (input: {
    chunkId: string;
    role: ChatRole;
    content: string;
    createdAt: string;
    id?: string;
  }) => ChatMessage;
  listMessages: (chunkId: string) => ChatMessage[];
  searchMessages: (query: string) => ChatSearchHit[];
  deleteByChunkIds: (chunkIds: string[]) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesByChunkId: {},
      appendMessage: (input) => {
        const message: ChatMessage = {
          id: input.id ?? crypto.randomUUID(),
          chunkId: input.chunkId,
          role: input.role,
          content: input.content,
          createdAt: input.createdAt,
        };
        set((state) => {
          const existing = state.messagesByChunkId[input.chunkId] ?? [];
          return {
            messagesByChunkId: {
              ...state.messagesByChunkId,
              [input.chunkId]: [...existing, message],
            },
          };
        });
        return message;
      },
      listMessages: (chunkId) => get().messagesByChunkId[chunkId] ?? [],
      searchMessages: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const hits: ChatSearchHit[] = [];
        for (const [chunkId, messages] of Object.entries(get().messagesByChunkId)) {
          for (const message of messages) {
            if (!message.content.toLowerCase().includes(q)) continue;
            hits.push({
              chunkId,
              messageId: message.id,
              snippet: message.content.slice(0, 120),
            });
          }
        }
        return hits;
      },
      deleteByChunkIds: (chunkIds) => {
        const remove = new Set(chunkIds);
        set((state) => {
          const next: Record<string, ChatMessage[]> = {};
          for (const [chunkId, messages] of Object.entries(state.messagesByChunkId)) {
            if (!remove.has(chunkId)) next[chunkId] = messages;
          }
          return { messagesByChunkId: next };
        });
      },
      resetChat: () => set({ messagesByChunkId: {} }),
    }),
    {
      name: SESSION_PERSIST_KEYS.chat,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({ messagesByChunkId: state.messagesByChunkId }),
    },
  ),
);
```

`src/modules/chat/index.ts`:

```ts
export { useChatStore } from "./state/chatStore";
export type { ChatMessage, ChatRole, ChatSearchHit } from "./domain/chatTypes";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/modules/chat/state/chatStore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/chat
git commit -m "Add chat module with per-chunk message persistence."
```

---

### Task 3: Project path helpers

**Files:**
- Create: `src/modules/project/domain/projectPath.ts`
- Create: `src/modules/project/domain/projectPath.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  projectFolderBasename,
  projectParentDirectoryPath,
} from "./projectPath";

describe("projectPath", () => {
  it("returns basename for posix and windows paths", () => {
    expect(projectFolderBasename("/Users/a/work/app")).toBe("app");
    expect(projectFolderBasename("C:\\\\Users\\\\a\\\\work\\\\app")).toBe("app");
    expect(projectFolderBasename("/Users/a/work/app/")).toBe("app");
  });

  it("returns parent directory path", () => {
    expect(projectParentDirectoryPath("/Users/a/work/app")).toBe("/Users/a/work");
    expect(projectParentDirectoryPath("C:\\\\Users\\\\a\\\\work\\\\app")).toBe(
      "C:\\\\Users\\\\a\\\\work",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/project/domain/projectPath.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

```ts
function normalizeSeparators(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "");
}

export function projectFolderBasename(folderPath: string): string {
  const normalized = normalizeSeparators(folderPath);
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) ?? normalized;
}

export function projectParentDirectoryPath(folderPath: string): string {
  const normalized = normalizeSeparators(folderPath);
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized;
  // Keep Windows drive root like C:/
  const parent = normalized.slice(0, idx);
  return parent === "" ? "/" : parent;
}
```

Note: In the Windows test strings above, use real single backslashes in the source file (`"C:\\Users\\a\\work\\app"`), not double-escaped four times. The plan escaped for markdown only.

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun run test src/modules/project/domain/projectPath.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/domain/projectPath.ts src/modules/project/domain/projectPath.test.ts
git commit -m "Add project path basename and parent helpers."
```

---

### Task 4: Project types + chunk tree helpers

**Files:**
- Create: `src/modules/project/domain/projectTypes.ts`
- Create: `src/modules/project/domain/projectChunkTree.ts`
- Create: `src/modules/project/domain/projectChunkTree.test.ts`

- [ ] **Step 1: Write failing tree tests**

```ts
import { describe, expect, it } from "vitest";
import {
  projectCollectSubtreeChunkIds,
  projectListChildChunks,
  projectReorderSiblingChunks,
} from "./projectChunkTree";
import type { ProjectChunk } from "./projectTypes";

function chunk(
  partial: Pick<ProjectChunk, "id" | "projectId" | "parentChunkId" | "title"> &
    Partial<ProjectChunk>,
): ProjectChunk {
  return {
    pinned: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
    ...partial,
  };
}

describe("projectChunkTree", () => {
  const chunks: ProjectChunk[] = [
    chunk({ id: "r", projectId: "p", parentChunkId: null, title: "root", siblingOrder: 0 }),
    chunk({ id: "a", projectId: "p", parentChunkId: "r", title: "a", siblingOrder: 0 }),
    chunk({ id: "b", projectId: "p", parentChunkId: "r", title: "b", siblingOrder: 1 }),
    chunk({ id: "a1", projectId: "p", parentChunkId: "a", title: "a1", siblingOrder: 0 }),
  ];

  it("lists children sorted by siblingOrder", () => {
    expect(projectListChildChunks(chunks, "r").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("collects subtree ids including root", () => {
    expect(projectCollectSubtreeChunkIds(chunks, "a").sort()).toEqual(["a", "a1"]);
  });

  it("reorders siblings under the same parent", () => {
    const next = projectReorderSiblingChunks(chunks, "r", ["b", "a"]);
    expect(projectListChildChunks(next, "r").map((c) => c.id)).toEqual(["b", "a"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `bun run test src/modules/project/domain/projectChunkTree.test.ts`

- [ ] **Step 3: Implement types + helpers**

`projectTypes.ts`:

```ts
import type { ShellMainCard } from "../../shell/state/shellStore";

export interface ProjectChunkRestore {
  activeMainCard: ShellMainCard;
}

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  pinned: boolean;
  createdAt: string;
  lastOpenedAt: string;
  manualGroupId?: string;
  listOrder: number;
}

export interface ProjectChunk {
  id: string;
  projectId: string;
  parentChunkId: string | null;
  title: string;
  pinned: boolean;
  createdAt: string;
  lastOpenedAt: string;
  restore: ProjectChunkRestore;
  siblingOrder: number;
}

export interface ProjectGroup {
  id: string;
  label: string;
  projectIds: string[];
  order: number;
}
```

`projectChunkTree.ts`:

```ts
import type { ProjectChunk } from "./projectTypes";

export function projectListChildChunks(
  chunks: readonly ProjectChunk[],
  parentChunkId: string | null,
): ProjectChunk[] {
  return chunks
    .filter((c) => c.parentChunkId === parentChunkId)
    .slice()
    .sort((a, b) => a.siblingOrder - b.siblingOrder || a.title.localeCompare(b.title));
}

export function projectCollectSubtreeChunkIds(
  chunks: readonly ProjectChunk[],
  rootId: string,
): string[] {
  const byParent = new Map<string | null, ProjectChunk[]>();
  for (const chunk of chunks) {
    const list = byParent.get(chunk.parentChunkId) ?? [];
    list.push(chunk);
    byParent.set(chunk.parentChunkId, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    for (const child of byParent.get(id) ?? []) stack.push(child.id);
  }
  return out;
}

export function projectReorderSiblingChunks(
  chunks: readonly ProjectChunk[],
  parentChunkId: string | null,
  orderedIds: readonly string[],
): ProjectChunk[] {
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return chunks.map((chunk) => {
    if (chunk.parentChunkId !== parentChunkId || !order.has(chunk.id)) return chunk;
    return { ...chunk, siblingOrder: order.get(chunk.id)! };
  });
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/domain/projectTypes.ts src/modules/project/domain/projectChunkTree.ts src/modules/project/domain/projectChunkTree.test.ts
git commit -m "Add project chunk types and tree helpers."
```

---

### Task 5: Auto-group by parent directory

**Files:**
- Create: `src/modules/project/domain/projectAutoGroup.ts`
- Create: `src/modules/project/domain/projectAutoGroup.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { projectBuildAutoGroups } from "./projectAutoGroup";
import type { Project } from "./projectTypes";

const base = {
  pinned: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastOpenedAt: "2026-01-01T00:00:00.000Z",
  listOrder: 0,
};

describe("projectBuildAutoGroups", () => {
  it("groups by parent directory and leaves manual-grouped projects out", () => {
    const projects: Project[] = [
      { ...base, id: "1", name: "a", folderPath: "/work/apps/a" },
      { ...base, id: "2", name: "b", folderPath: "/work/apps/b" },
      {
        ...base,
        id: "3",
        name: "c",
        folderPath: "/work/other/c",
        manualGroupId: "g1",
      },
    ];
    const groups = projectBuildAutoGroups(projects);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("/work/apps");
    expect(groups[0]?.label).toBe("apps");
    expect(groups[0]?.projectIds.sort()).toEqual(["1", "2"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
import { projectFolderBasename, projectParentDirectoryPath } from "./projectPath";
import type { Project } from "./projectTypes";

export interface ProjectAutoGroup {
  key: string;
  label: string;
  projectIds: string[];
}

export function projectBuildAutoGroups(
  projects: readonly Project[],
): ProjectAutoGroup[] {
  const map = new Map<string, string[]>();
  for (const project of projects) {
    if (project.manualGroupId) continue;
    const key = projectParentDirectoryPath(project.folderPath);
    const list = map.get(key) ?? [];
    list.push(project.id);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, projectIds]) => ({
      key,
      label: projectFolderBasename(key),
      projectIds,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/domain/projectAutoGroup.ts src/modules/project/domain/projectAutoGroup.test.ts
git commit -m "Add parent-directory auto grouping for projects."
```

---

### Task 6: Retention selection (30d + pin rules)

**Files:**
- Create: `src/modules/project/domain/projectRetention.ts`
- Create: `src/modules/project/domain/projectRetention.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { projectSelectExpired } from "./projectRetention";
import type { Project, ProjectChunk } from "./projectTypes";

const NOW = Date.parse("2026-07-10T00:00:00.000Z");
const OLD = "2026-05-01T00:00:00.000Z";
const RECENT = "2026-07-01T00:00:00.000Z";

function p(partial: Partial<Project> & Pick<Project, "id">): Project {
  return {
    name: partial.id,
    folderPath: `/p/${partial.id}`,
    pinned: false,
    createdAt: OLD,
    lastOpenedAt: OLD,
    listOrder: 0,
    ...partial,
  };
}

function c(
  partial: Partial<ProjectChunk> & Pick<ProjectChunk, "id" | "projectId">,
): ProjectChunk {
  return {
    parentChunkId: null,
    title: partial.id,
    pinned: false,
    createdAt: OLD,
    lastOpenedAt: OLD,
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
    ...partial,
  };
}

describe("projectSelectExpired", () => {
  it("expires unpinned stale chunks and projects without pinned chunks", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "stale" }), p({ id: "fresh", lastOpenedAt: RECENT })],
      chunks: [
        c({ id: "c-stale", projectId: "stale", lastOpenedAt: OLD }),
        c({ id: "c-fresh", projectId: "fresh", lastOpenedAt: RECENT }),
      ],
    });
    expect(result.chunkIds.sort()).toEqual(["c-stale"]);
    expect(result.projectIds.sort()).toEqual(["stale"]);
  });

  it("keeps pinned chunk and its ancestor project", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "p1" })],
      chunks: [
        c({ id: "root", projectId: "p1", lastOpenedAt: OLD }),
        c({
          id: "pin",
          projectId: "p1",
          parentChunkId: "root",
          pinned: true,
          lastOpenedAt: OLD,
        }),
      ],
    });
    expect(result.chunkIds).toEqual([]);
    expect(result.projectIds).toEqual([]);
  });

  it("keeps pinned projects even when stale", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "p1", pinned: true })],
      chunks: [c({ id: "c1", projectId: "p1", lastOpenedAt: OLD })],
    });
    expect(result.projectIds).toEqual([]);
    expect(result.chunkIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
import type { Project, ProjectChunk } from "./projectTypes";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ProjectRetentionResult {
  projectIds: string[];
  chunkIds: string[];
}

export function projectSelectExpired(input: {
  nowMs: number;
  retentionDays: number;
  projects: readonly Project[];
  chunks: readonly ProjectChunk[];
}): ProjectRetentionResult {
  const cutoff = input.nowMs - input.retentionDays * MS_PER_DAY;
  const isStale = (iso: string) => Date.parse(iso) < cutoff;

  const pinnedChunkProjectIds = new Set(
    input.chunks.filter((c) => c.pinned).map((c) => c.projectId),
  );

  const expiredChunkIds = input.chunks
    .filter((c) => !c.pinned && isStale(c.lastOpenedAt))
    .filter((c) => {
      const project = input.projects.find((p) => p.id === c.projectId);
      return !(project?.pinned);
    })
    .map((c) => c.id);

  // If any chunk in a project is pinned, retain all chunks in that project for v1 simplicity
  // consistent with "ancestor project retained while pinned chunk exists".
  const retainAllChunksForProjects = pinnedChunkProjectIds;
  const chunkIds = expiredChunkIds.filter((id) => {
    const chunk = input.chunks.find((c) => c.id === id);
    return chunk ? !retainAllChunksForProjects.has(chunk.projectId) : false;
  });

  const projectIds = input.projects
    .filter((p) => !p.pinned)
    .filter((p) => isStale(p.lastOpenedAt))
    .filter((p) => !pinnedChunkProjectIds.has(p.id))
    .map((p) => p.id);

  return { projectIds, chunkIds };
}
```

Retention note locked by this implementation: if a project has any pinned chunk, **no** chunks in that project auto-delete (avoids orphaning pinned nodes). Stale unpinned projects without pinned chunks still expire.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/domain/projectRetention.ts src/modules/project/domain/projectRetention.test.ts
git commit -m "Add 30-day project retention selection with pin exemptions."
```

---

### Task 7: Workspace migrate helper

**Files:**
- Create: `src/modules/project/domain/projectMigrate.ts`
- Create: `src/modules/project/domain/projectMigrate.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { projectMigrateFromWorkspace } from "./projectMigrate";

describe("projectMigrateFromWorkspace", () => {
  it("returns null when workspace missing or projects already exist", () => {
    expect(
      projectMigrateFromWorkspace({
        workspacePath: null,
        existingProjectCount: 0,
        nowIso: "2026-07-10T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      projectMigrateFromWorkspace({
        workspacePath: "/work/app",
        existingProjectCount: 1,
        nowIso: "2026-07-10T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("builds one project and one root chunk", () => {
    const result = projectMigrateFromWorkspace({
      workspacePath: "/work/app",
      existingProjectCount: 0,
      nowIso: "2026-07-10T00:00:00.000Z",
      projectId: "p1",
      chunkId: "c1",
    });
    expect(result?.project.name).toBe("app");
    expect(result?.project.folderPath).toBe("/work/app");
    expect(result?.chunk.parentChunkId).toBeNull();
    expect(result?.chunk.projectId).toBe("p1");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
import { projectFolderBasename } from "./projectPath";
import type { Project, ProjectChunk } from "./projectTypes";

export function projectMigrateFromWorkspace(input: {
  workspacePath: string | null;
  existingProjectCount: number;
  nowIso: string;
  projectId?: string;
  chunkId?: string;
}): { project: Project; chunk: ProjectChunk } | null {
  if (!input.workspacePath || input.existingProjectCount > 0) return null;
  const projectId = input.projectId ?? crypto.randomUUID();
  const chunkId = input.chunkId ?? crypto.randomUUID();
  const project: Project = {
    id: projectId,
    name: projectFolderBasename(input.workspacePath),
    folderPath: input.workspacePath,
    pinned: false,
    createdAt: input.nowIso,
    lastOpenedAt: input.nowIso,
    listOrder: 0,
  };
  const chunk: ProjectChunk = {
    id: chunkId,
    projectId,
    parentChunkId: null,
    title: "Main",
    pinned: false,
    createdAt: input.nowIso,
    lastOpenedAt: input.nowIso,
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
  };
  return { project, chunk };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/domain/projectMigrate.ts src/modules/project/domain/projectMigrate.test.ts
git commit -m "Add workspace-to-project migration helper."
```

---

### Task 8: Search merge (titles first, then messages)

**Files:**
- Create: `src/modules/project/domain/projectSearch.ts`
- Create: `src/modules/project/domain/projectSearch.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { projectMergeSearchResults } from "./projectSearch";

describe("projectMergeSearchResults", () => {
  it("ranks title hits before message hits and dedupes chunk ids", () => {
    const merged = projectMergeSearchResults({
      titleChunkIds: ["c2", "c1"],
      messageChunkIds: ["c1", "c3"],
    });
    expect(merged).toEqual(["c2", "c1", "c3"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
export function projectMergeSearchResults(input: {
  titleChunkIds: readonly string[];
  messageChunkIds: readonly string[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...input.titleChunkIds, ...input.messageChunkIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/domain/projectSearch.ts src/modules/project/domain/projectSearch.test.ts
git commit -m "Add project search ranking merge helper."
```

---

### Task 9: `projectStore` core CRUD

**Files:**
- Create: `src/modules/project/state/projectStore.ts`
- Create: `src/modules/project/state/projectStore.test.ts`

- [ ] **Step 1: Write failing tests for create/pin/child/reorder**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useChatStore } from "../../chat/state/chatStore";
import { useProjectStore } from "./projectStore";

describe("projectStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useChatStore.getState().resetChat();
  });

  it("creates project with root chunk and sets active ids", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    expect(project.name).toBe("app");
    expect(chunk.parentChunkId).toBeNull();
    expect(useProjectStore.getState().activeProjectId).toBe(project.id);
    expect(useProjectStore.getState().activeChunkId).toBe(chunk.id);
  });

  it("adds child chunk under parent", () => {
    const { chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    });
    expect(child?.parentChunkId).toBe(root.id);
  });

  it("pins project and chunk", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setProjectPinned(project.id, true);
    useProjectStore.getState().setChunkPinned(chunk.id, true);
    expect(useProjectStore.getState().projects.find((p) => p.id === project.id)?.pinned).toBe(
      true,
    );
    expect(useProjectStore.getState().chunks.find((c) => c.id === chunk.id)?.pinned).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement store**

Create `src/modules/project/state/projectStore.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useChatStore } from "../../chat/state/chatStore";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";
import {
  projectCollectSubtreeChunkIds,
  projectListChildChunks,
  projectReorderSiblingChunks,
} from "../domain/projectChunkTree";
import { projectMigrateFromWorkspace } from "../domain/projectMigrate";
import { projectFolderBasename } from "../domain/projectPath";
import { projectSelectExpired } from "../domain/projectRetention";
import type {
  Project,
  ProjectChunk,
  ProjectChunkRestore,
  ProjectGroup,
} from "../domain/projectTypes";

const EMPTY = {
  projects: [] as Project[],
  chunks: [] as ProjectChunk[],
  groups: [] as ProjectGroup[],
  activeProjectId: null as string | null,
  activeChunkId: null as string | null,
  expandedProjectIds: [] as string[],
  panelError: null as string | null,
};

export interface ProjectState {
  projects: Project[];
  chunks: ProjectChunk[];
  groups: ProjectGroup[];
  activeProjectId: string | null;
  activeChunkId: string | null;
  expandedProjectIds: string[];
  panelError: string | null;
  resetProjectState: () => void;
  setPanelError: (message: string | null) => void;
  createProjectWithRootChunk: (input: {
    folderPath: string;
    nowIso: string;
    projectId?: string;
    chunkId?: string;
  }) => { project: Project; chunk: ProjectChunk };
  addChildChunk: (input: {
    parentChunkId: string;
    title: string;
    nowIso: string;
  }) => ProjectChunk | null;
  addRootChunk: (input: {
    projectId: string;
    title: string;
    nowIso: string;
  }) => ProjectChunk | null;
  setProjectPinned: (projectId: string, pinned: boolean) => void;
  setChunkPinned: (chunkId: string, pinned: boolean) => void;
  setChunkRestore: (chunkId: string, restore: ProjectChunkRestore) => void;
  touchChunkActivity: (chunkId: string, nowIso: string) => void;
  setActiveIds: (projectId: string | null, chunkId: string | null) => void;
  toggleProjectExpanded: (projectId: string) => void;
  createManualGroup: (label: string) => ProjectGroup;
  assignProjectToGroup: (projectId: string, groupId: string | null) => void;
  reorderProjectsInGroup: (groupId: string, orderedProjectIds: string[]) => void;
  reorderSiblingChunks: (
    parentChunkId: string | null,
    orderedIds: string[],
  ) => void;
  findProjectByFolderPath: (folderPath: string) => Project | undefined;
  applyMigration: (workspacePath: string | null, nowIso: string) => void;
  updateProjectFolder: (projectId: string, folderPath: string) => void;
  deleteChunkCascade: (chunkId: string) => void;
  deleteProjectCascade: (projectId: string) => void;
  runRetentionSweep: (input: { nowMs: number; retentionDays: number }) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      resetProjectState: () => set({ ...EMPTY }),
      setPanelError: (message) => set({ panelError: message }),
      createProjectWithRootChunk: (input) => {
        const projectId = input.projectId ?? crypto.randomUUID();
        const chunkId = input.chunkId ?? crypto.randomUUID();
        const project: Project = {
          id: projectId,
          name: projectFolderBasename(input.folderPath),
          folderPath: input.folderPath,
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          listOrder: get().projects.length,
        };
        const chunk: ProjectChunk = {
          id: chunkId,
          projectId,
          parentChunkId: null,
          title: "Main",
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          restore: { activeMainCard: "chat" },
          siblingOrder: 0,
        };
        set((state) => ({
          projects: [...state.projects, project],
          chunks: [...state.chunks, chunk],
          activeProjectId: projectId,
          activeChunkId: chunkId,
          expandedProjectIds: state.expandedProjectIds.includes(projectId)
            ? state.expandedProjectIds
            : [...state.expandedProjectIds, projectId],
        }));
        return { project, chunk };
      },
      addChildChunk: (input) => {
        const parent = get().chunks.find((c) => c.id === input.parentChunkId);
        if (!parent) return null;
        const siblings = projectListChildChunks(get().chunks, parent.id);
        const chunk: ProjectChunk = {
          id: crypto.randomUUID(),
          projectId: parent.projectId,
          parentChunkId: parent.id,
          title: input.title,
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          restore: { activeMainCard: "chat" },
          siblingOrder: siblings.length,
        };
        set((state) => ({ chunks: [...state.chunks, chunk] }));
        return chunk;
      },
      addRootChunk: (input) => {
        if (!get().projects.some((p) => p.id === input.projectId)) return null;
        const siblings = projectListChildChunks(get().chunks, null).filter(
          (c) => c.projectId === input.projectId,
        );
        const chunk: ProjectChunk = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          parentChunkId: null,
          title: input.title,
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          restore: { activeMainCard: "chat" },
          siblingOrder: siblings.length,
        };
        set((state) => ({ chunks: [...state.chunks, chunk] }));
        return chunk;
      },
      setProjectPinned: (projectId, pinned) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, pinned } : p,
          ),
        })),
      setChunkPinned: (chunkId, pinned) =>
        set((state) => ({
          chunks: state.chunks.map((c) =>
            c.id === chunkId ? { ...c, pinned } : c,
          ),
        })),
      setChunkRestore: (chunkId, restore) =>
        set((state) => ({
          chunks: state.chunks.map((c) =>
            c.id === chunkId ? { ...c, restore } : c,
          ),
        })),
      touchChunkActivity: (chunkId, nowIso) =>
        set((state) => {
          const chunk = state.chunks.find((c) => c.id === chunkId);
          if (!chunk) return state;
          return {
            chunks: state.chunks.map((c) =>
              c.id === chunkId ? { ...c, lastOpenedAt: nowIso } : c,
            ),
            projects: state.projects.map((p) =>
              p.id === chunk.projectId ? { ...p, lastOpenedAt: nowIso } : p,
            ),
          };
        }),
      setActiveIds: (projectId, chunkId) =>
        set({ activeProjectId: projectId, activeChunkId: chunkId }),
      toggleProjectExpanded: (projectId) =>
        set((state) => ({
          expandedProjectIds: state.expandedProjectIds.includes(projectId)
            ? state.expandedProjectIds.filter((id) => id !== projectId)
            : [...state.expandedProjectIds, projectId],
        })),
      createManualGroup: (label) => {
        const group: ProjectGroup = {
          id: crypto.randomUUID(),
          label,
          projectIds: [],
          order: get().groups.length,
        };
        set((state) => ({ groups: [...state.groups, group] }));
        return group;
      },
      assignProjectToGroup: (projectId, groupId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, manualGroupId: groupId ?? undefined }
              : p,
          ),
          groups: state.groups.map((g) => ({
            ...g,
            projectIds:
              g.id === groupId
                ? g.projectIds.includes(projectId)
                  ? g.projectIds
                  : [...g.projectIds, projectId]
                : g.projectIds.filter((id) => id !== projectId),
          })),
        })),
      reorderProjectsInGroup: (groupId, orderedProjectIds) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, projectIds: [...orderedProjectIds] } : g,
          ),
        })),
      reorderSiblingChunks: (parentChunkId, orderedIds) =>
        set((state) => ({
          chunks: projectReorderSiblingChunks(
            state.chunks,
            parentChunkId,
            orderedIds,
          ),
        })),
      findProjectByFolderPath: (folderPath) =>
        get().projects.find((p) => p.folderPath === folderPath),
      applyMigration: (workspacePath, nowIso) => {
        const migrated = projectMigrateFromWorkspace({
          workspacePath,
          existingProjectCount: get().projects.length,
          nowIso,
        });
        if (!migrated) return;
        set((state) => ({
          projects: [...state.projects, migrated.project],
          chunks: [...state.chunks, migrated.chunk],
          activeProjectId: migrated.project.id,
          activeChunkId: migrated.chunk.id,
          expandedProjectIds: [...state.expandedProjectIds, migrated.project.id],
        }));
      },
      updateProjectFolder: (projectId, folderPath) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  folderPath,
                  name: projectFolderBasename(folderPath),
                }
              : p,
          ),
        })),
      deleteChunkCascade: (chunkId) => {
        const ids = projectCollectSubtreeChunkIds(get().chunks, chunkId);
        const idSet = new Set(ids);
        const chunk = get().chunks.find((c) => c.id === chunkId);
        useChatStore.getState().deleteByChunkIds(ids);
        set((state) => {
          const chunks = state.chunks.filter((c) => !idSet.has(c.id));
          const projectId = chunk?.projectId;
          const projectStillHasChunks = chunks.some(
            (c) => c.projectId === projectId,
          );
          return {
            chunks,
            projects:
              projectId && !projectStillHasChunks
                ? state.projects.filter((p) => p.id !== projectId)
                : state.projects,
            activeChunkId: idSet.has(state.activeChunkId ?? "")
              ? null
              : state.activeChunkId,
            activeProjectId:
              projectId &&
              !projectStillHasChunks &&
              state.activeProjectId === projectId
                ? null
                : state.activeProjectId,
          };
        });
      },
      deleteProjectCascade: (projectId) => {
        const ids = get()
          .chunks.filter((c) => c.projectId === projectId)
          .map((c) => c.id);
        useChatStore.getState().deleteByChunkIds(ids);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          chunks: state.chunks.filter((c) => c.projectId !== projectId),
          groups: state.groups.map((g) => ({
            ...g,
            projectIds: g.projectIds.filter((id) => id !== projectId),
          })),
          activeProjectId:
            state.activeProjectId === projectId ? null : state.activeProjectId,
          activeChunkId: ids.includes(state.activeChunkId ?? "")
            ? null
            : state.activeChunkId,
          expandedProjectIds: state.expandedProjectIds.filter(
            (id) => id !== projectId,
          ),
        }));
      },
      runRetentionSweep: (input) => {
        const expired = projectSelectExpired({
          nowMs: input.nowMs,
          retentionDays: input.retentionDays,
          projects: get().projects,
          chunks: get().chunks,
        });
        for (const chunkId of expired.chunkIds) {
          if (get().chunks.some((c) => c.id === chunkId)) {
            get().deleteChunkCascade(chunkId);
          }
        }
        for (const projectId of expired.projectIds) {
          if (get().projects.some((p) => p.id === projectId)) {
            get().deleteProjectCascade(projectId);
          }
        }
      },
    }),
    {
      name: SESSION_PERSIST_KEYS.project,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({
        projects: state.projects,
        chunks: state.chunks,
        groups: state.groups,
        activeProjectId: state.activeProjectId,
        activeChunkId: state.activeChunkId,
        expandedProjectIds: state.expandedProjectIds,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/state/projectStore.ts src/modules/project/state/projectStore.test.ts
git commit -m "Add project store CRUD for projects and chunks."
```

---

### Task 10: Cascade delete + retention sweep tests

**Files:**
- Modify: `src/modules/project/state/projectStore.test.ts`

Cascade + `runRetentionSweep` are already implemented in Task 9. This task locks them with tests (they should pass immediately if Task 9 is correct).

- [ ] **Step 1: Add cascade/retention tests**

```ts
  it("deleting a chunk removes subtree and chat messages", () => {
    const { chunk: root } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    const child = useProjectStore.getState().addChildChunk({
      parentChunkId: root.id,
      title: "Child",
      nowIso: "2026-07-10T00:00:01.000Z",
    })!;
    useChatStore.getState().appendMessage({
      chunkId: child.id,
      role: "user",
      content: "bye",
      createdAt: "2026-07-10T00:00:02.000Z",
    });
    useProjectStore.getState().deleteChunkCascade(child.id);
    expect(useProjectStore.getState().chunks.find((c) => c.id === child.id)).toBeUndefined();
    expect(useChatStore.getState().listMessages(child.id)).toEqual([]);
  });

  it("retention sweep deletes expired unpinned data and chat", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/old",
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    useChatStore.getState().appendMessage({
      chunkId: chunk.id,
      role: "user",
      content: "old",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    useProjectStore.setState({
      projects: [{ ...project, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
      chunks: [{ ...chunk, lastOpenedAt: "2026-01-01T00:00:00.000Z" }],
    });
    useProjectStore.getState().runRetentionSweep({
      nowMs: Date.parse("2026-07-10T00:00:00.000Z"),
      retentionDays: 30,
    });
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useChatStore.getState().listMessages(chunk.id)).toEqual([]);
  });
```

- [ ] **Step 2: Run — expect PASS** (implementation already in Task 9; if FAIL, fix store bugs)

- [ ] **Step 3: Commit**

```bash
git add src/modules/project/state/projectStore.test.ts
git commit -m "Cover project delete cascade and retention sweep."
```

---

### Task 11: Activation, restore writeback, open folder

**Files:**
- Create: `src/modules/project/state/projectActivation.ts`
- Create: `src/modules/project/state/projectActivation.test.ts`
- Create: `src/modules/project/index.ts`

- [ ] **Step 1: Write failing activation tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";
import {
  projectActivateChunk,
  projectOpenFolder,
  projectSyncRestoreFromShell,
} from "./projectActivation";

describe("projectActivation", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useWorkspaceStore.setState({ workspacePath: null });
    useShellStore.setState({ activeMainCard: "chat" });
  });

  it("activateChunk sets workspace and shell card from restore", () => {
    const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    useProjectStore.getState().setChunkRestore(chunk.id, { activeMainCard: "terminal" });
    projectActivateChunk(chunk.id);
    expect(useWorkspaceStore.getState().workspacePath).toBe(project.folderPath);
    expect(useShellStore.getState().activeMainCard).toBe("terminal");
    expect(useProjectStore.getState().activeChunkId).toBe(chunk.id);
  });

  it("syncs shell card changes back onto active chunk", () => {
    const { chunk } = useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    projectActivateChunk(chunk.id);
    useShellStore.getState().setActiveMainCard("editor");
    projectSyncRestoreFromShell();
    expect(
      useProjectStore.getState().chunks.find((c) => c.id === chunk.id)?.restore.activeMainCard,
    ).toBe("editor");
  });

  it("openFolder finds or creates project", () => {
    const first = projectOpenFolder("/work/app", "2026-07-10T00:00:00.000Z");
    const second = projectOpenFolder("/work/app", "2026-07-10T00:00:01.000Z");
    expect(first.project.id).toBe(second.project.id);
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `projectActivation.ts`**

```ts
import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";

export function projectActivateChunk(chunkId: string, nowIso = new Date().toISOString()): void {
  const state = useProjectStore.getState();
  const chunk = state.chunks.find((c) => c.id === chunkId);
  if (!chunk) return;
  const project = state.projects.find((p) => p.id === chunk.projectId);
  if (!project) return;
  state.touchChunkActivity(chunkId, nowIso);
  state.setActiveIds(project.id, chunk.id);
  useWorkspaceStore.getState().setWorkspace(project.folderPath);
  useShellStore.getState().setActiveMainCard(chunk.restore.activeMainCard);
}

export function projectActivateProject(projectId: string, nowIso = new Date().toISOString()): void {
  const state = useProjectStore.getState();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const roots = state.chunks
    .filter((c) => c.projectId === projectId && c.parentChunkId === null)
    .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
  const target = roots[0];
  if (!target) return;
  projectActivateChunk(target.id, nowIso);
}

export function projectSyncRestoreFromShell(): void {
  const chunkId = useProjectStore.getState().activeChunkId;
  if (!chunkId) return;
  const card = useShellStore.getState().activeMainCard;
  useProjectStore.getState().setChunkRestore(chunkId, { activeMainCard: card });
}

export function projectOpenFolder(folderPath: string, nowIso = new Date().toISOString()) {
  const state = useProjectStore.getState();
  const existing = state.findProjectByFolderPath(folderPath);
  if (existing) {
    projectActivateProject(existing.id, nowIso);
    return {
      project: existing,
      chunk: state.chunks.find((c) => c.id === useProjectStore.getState().activeChunkId)!,
    };
  }
  const created = state.createProjectWithRootChunk({ folderPath, nowIso });
  useWorkspaceStore.getState().setWorkspace(folderPath);
  useShellStore.getState().setActiveMainCard(created.chunk.restore.activeMainCard);
  return created;
}

export function projectBootMigrateAndSweep(input: {
  workspacePath: string | null;
  nowIso: string;
  nowMs: number;
  retentionDays?: number;
}): void {
  const state = useProjectStore.getState();
  state.applyMigration(input.workspacePath, input.nowIso);
  state.runRetentionSweep({
    nowMs: input.nowMs,
    retentionDays: input.retentionDays ?? 30,
  });
  if (state.activeChunkId) {
    projectActivateChunk(state.activeChunkId, input.nowIso);
  } else if (input.workspacePath) {
    const project = state.findProjectByFolderPath(input.workspacePath);
    if (project) projectActivateProject(project.id, input.nowIso);
  }
}
```

Export from `src/modules/project/index.ts`:

```ts
export { ProjectLeftPanel } from "./ui/projectLeftPanel";
export {
  projectActivateChunk,
  projectActivateProject,
  projectBootMigrateAndSweep,
  projectOpenFolder,
  projectSyncRestoreFromShell,
} from "./state/projectActivation";
export { useProjectStore } from "./state/projectStore";
```

`ProjectLeftPanel` can be a temporary stub in this task if UI comes later:

```tsx
export function ProjectLeftPanel() {
  return <div data-testid="project-left-panel" />;
}
```

Or defer the export until Task 13 and only export activation APIs now — if so, keep `index.ts` without the panel until Task 13.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/state/projectActivation.ts src/modules/project/state/projectActivation.test.ts src/modules/project/index.ts
git commit -m "Add project activation, restore sync, and open-folder flow."
```

---

### Task 12: Session reset + boot wiring

**Files:**
- Modify: `src/modules/session/state/sessionReset.ts`
- Modify: `src/modules/session/state/sessionReset.test.ts`
- Modify: `src/modules/session/ui/sessionRoot.tsx`

- [ ] **Step 1: Extend reset test expectations**

In `sessionReset.test.ts` `beforeEach`, also seed chat/project:

```ts
import { useChatStore } from "../../chat/state/chatStore";
import { useProjectStore } from "../../project/state/projectStore";

// in beforeEach after other seeds:
useProjectStore.getState().createProjectWithRootChunk({
  folderPath: "/tmp/x",
  nowIso: "2026-07-10T00:00:00.000Z",
});
useChatStore.getState().appendMessage({
  chunkId: useProjectStore.getState().activeChunkId!,
  role: "user",
  content: "x",
  createdAt: "2026-07-10T00:00:00.000Z",
});
```

Assert after reset:

```ts
expect(useProjectStore.getState().projects).toEqual([]);
expect(useChatStore.getState().messagesByChunkId).toEqual({});
```

- [ ] **Step 2: Run reset test — expect FAIL**

- [ ] **Step 3: Update `resetAllPersistedSession`**

```ts
import { useChatStore } from "../../chat/state/chatStore";
import { useProjectStore } from "../../project/state/projectStore";

// inside resetAllPersistedSession, with other resets:
useProjectStore.getState().resetProjectState();
useChatStore.getState().resetChat();
```

- [ ] **Step 4: Wire `sessionRoot` rehydrate + boot**

After existing `Promise.all` rehydrates, also:

```ts
useProjectStore.persist.rehydrate(),
useChatStore.persist.rehydrate(),
```

After persist ready / when `ready` becomes true (new `useEffect`), call:

```ts
projectBootMigrateAndSweep({
  workspacePath: useWorkspaceStore.getState().workspacePath,
  nowIso: new Date().toISOString(),
  nowMs: Date.now(),
});
```

Also subscribe shell card changes to restore writeback (effect in `SessionRoot` or `ShellScreen`):

```ts
useEffect(() => {
  return useShellStore.subscribe((state, prev) => {
    if (state.activeMainCard !== prev.activeMainCard) {
      projectSyncRestoreFromShell();
    }
  });
}, []);
```

- [ ] **Step 5: Run**

Run: `bun run test src/modules/session/state/sessionReset.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/session/state/sessionReset.ts src/modules/session/state/sessionReset.test.ts src/modules/session/ui/sessionRoot.tsx
git commit -m "Wire project and chat into session boot and debug reset."
```

---

### Task 13: Workspace popup opens projects

**Files:**
- Modify: `src/modules/workspace-popup/ui/workspacePopup.tsx`
- Modify: `src/modules/workspace-popup/ui/workspacePopup.test.tsx`

- [ ] **Step 1: Update test to expect a project**

After successful open:

```ts
import { useProjectStore } from "../../project/state/projectStore";

// beforeEach also:
useProjectStore.getState().resetProjectState();

// in success test:
await waitFor(() => {
  expect(useWorkspaceStore.getState().workspacePath).toBe("/tmp/opened");
});
expect(useProjectStore.getState().projects[0]?.folderPath).toBe("/tmp/opened");
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Change open handler**

Replace `setWorkspace(path)` with:

```ts
import { projectOpenFolder } from "../../project/state/projectActivation";

projectOpenFolder(path);
```

Remove direct `setWorkspace` usage from this handler (`projectOpenFolder` already sets workspace).

- [ ] **Step 4: Run workspace popup tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/workspace-popup/ui/workspacePopup.tsx src/modules/workspace-popup/ui/workspacePopup.test.tsx
git commit -m "Open folder creates or activates a project."
```

---

### Task 14: Left panel UI — list, expand, select, empty CTA

**Files:**
- Create: `src/modules/project/ui/projectLeftPanel.tsx`
- Create: `src/modules/project/ui/projectChunkTree.tsx`
- Create: `src/modules/project/ui/projectLeftPanel.test.tsx`
- Modify: `src/modules/project/index.ts`
- Modify: `src/modules/shell/ui/panels/shellLeftPanel.tsx`

- [ ] **Step 1: Write failing panel tests**

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useProjectStore } from "../state/projectStore";
import { ProjectLeftPanel } from "./projectLeftPanel";

describe("ProjectLeftPanel", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
  });

  it("shows empty CTA when no projects", () => {
    const onOpenProject = vi.fn();
    render(<ProjectLeftPanel onRequestOpenProject={onOpenProject} />);
    expect(screen.getByRole("button", { name: /open project/i })).toBeInTheDocument();
  });

  it("selects a chunk on click", async () => {
    const user = userEvent.setup();
    useProjectStore.getState().createProjectWithRootChunk({
      folderPath: "/work/app",
      nowIso: "2026-07-10T00:00:00.000Z",
    });
    render(<ProjectLeftPanel />);
    await user.click(screen.getByRole("button", { name: /main/i }));
    expect(useProjectStore.getState().activeChunkId).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement panel + tree**

Requirements:

- Header label “Projects”
- Search input (wired in Task 15; can be present disabled/no-op filter for now or fully wired)
- Empty state button calling `onRequestOpenProject?: () => void`
- Pinned projects section when any `project.pinned`
- For each project: expand/collapse, show name, list root chunks via `projectChunkTree`
- Chunk button calls `projectActivateChunk`
- Use existing Tailwind/font-mono styles consistent with shell panels
- Keep `ShellPanelResizeHandle` in `shellLeftPanel.tsx`; replace placeholder body with `<ProjectLeftPanel />`

`shellLeftPanel.tsx`:

```tsx
import { ProjectLeftPanel } from "../../../project";
import { useShellStore } from "../../state/shellStore";
import { ShellPanelResizeHandle } from "../shellPanelResizeHandle";

export function ShellLeftPanel() {
  const setLeftPanelWidth = useShellStore((s) => s.setLeftPanelWidth);
  return (
    <aside
      aria-label="left panel"
      className="relative flex min-h-0 min-w-0 flex-col border-r border-border bg-background"
    >
      <ShellPanelResizeHandle
        edge="end"
        ariaLabel="Resize left panel"
        getWidth={() => useShellStore.getState().leftPanelWidth}
        onResize={setLeftPanelWidth}
      />
      <ProjectLeftPanel />
    </aside>
  );
}
```

- [ ] **Step 4: Run panel + shell tests**

Run: `bun run test src/modules/project/ui/projectLeftPanel.test.tsx src/modules/shell/ui/shellScreen.test.tsx`

Expected: PASS (update shell test if it looked for “Left Panel” text — it uses `aria-label="left panel"`, still present)

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/ui src/modules/project/index.ts src/modules/shell/ui/panels/shellLeftPanel.tsx
git commit -m "Render project navigator in the shell left panel."
```

---

### Task 15: Pin, add child, add root, manual delete

**Files:**
- Modify: `src/modules/project/ui/projectLeftPanel.tsx`
- Modify: `src/modules/project/ui/projectChunkTree.tsx`
- Modify: `src/modules/project/ui/projectLeftPanel.test.tsx`

- [ ] **Step 1: Add failing interaction tests**

Cover:

- Pin project via button `aria-label="Pin project {name}"`
- Add child via `aria-label="Add child chunk"`
- Delete chunk with `window.confirm` mocked true → chunk removed

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement controls**

- Context-free inline icon buttons (lucide `Pin`, `Plus`, `Trash2`)
- Delete uses `confirm("Delete this chunk and its children?")` then `deleteChunkCascade`
- Add child: `addChildChunk` then activate new chunk
- Add root chunk on project row
- Relink: button `aria-label="Relink folder"` calls injected `folderPicker.pickFolder()`; on path, `updateProjectFolder` + if active project then `useWorkspaceStore.getState().setWorkspace(path)`

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/ui
git commit -m "Add pin, nested chunk create, and delete to project panel."
```

---

### Task 16: Search (names + chat bodies)

**Files:**
- Modify: `src/modules/project/ui/projectLeftPanel.tsx`
- Modify: `src/modules/project/ui/projectLeftPanel.test.tsx`
- Optionally create: `src/modules/project/ui/projectSearch.ts` for pure filter helper used by UI

- [ ] **Step 1: Failing test**

Seed project titled `Alpha`, chunk `Main`, message `unique-zebra-token` on another chunk; type query into searchbox; expect matching rows only.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
const titleChunkIds = chunks
  .filter((c) => c.title.toLowerCase().includes(q))
  .map((c) => c.id);
// also include chunks whose project name or group label matches
const messageChunkIds = useChatStore.getState().searchMessages(q).map((h) => h.chunkId);
const visibleChunkIds = new Set(projectMergeSearchResults({ titleChunkIds, messageChunkIds }));
```

Filter rendered tree to visible chunks (keep ancestors so nested hits remain reachable).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/ui
git commit -m "Add project panel search across titles and chat messages."
```

---

### Task 17: Manual groups + auto-group rendering

**Files:**
- Modify: `src/modules/project/ui/projectLeftPanel.tsx`
- Modify: `src/modules/project/state/projectStore.ts` (if group APIs incomplete)
- Modify: `src/modules/project/ui/projectLeftPanel.test.tsx`

- [ ] **Step 1: Failing test**

Two projects under `/work/apps/*` render under an auto group labeled `apps`. Assign one project to manual group `Favorites` and assert it leaves the auto group.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement UI sections**

Order:

1. Pinned
2. Manual groups (`groups` sorted by `order`)
3. Auto groups from `projectBuildAutoGroups`
4. Ungrouped leftovers (should be empty if auto-group covers all non-manual)

Provide a simple “Move to group…” using `window.prompt` for v1 label entry **or** a small select of existing groups + “New group” — prefer prompt only if keeping UI minimal; otherwise a `Menu` is fine if already available. This repo currently has `Button` only — use `prompt` for new group name and buttons for assign/unpin-from-group to avoid new dependencies.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project
git commit -m "Render auto and manual project groups in the left panel."
```

---

### Task 18: HTML5 sibling drag-reorder

**Files:**
- Modify: `src/modules/project/ui/projectChunkTree.tsx`
- Modify: `src/modules/project/ui/projectLeftPanel.test.tsx` (optional; prefer unit test on store reorder already covered — add one DnD fireEvent test)

- [ ] **Step 1: Failing test with `fireEvent.dragStart` / `drop`**

Two sibling chunks; drag B onto A’s drop zone; expect order `[B, A]` via `siblingOrder`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

- `draggable` on chunk rows
- `onDragStart` stores chunk id + parent id in `dataTransfer`
- `onDragOver` preventDefault
- `onDrop` rebuilds ordered sibling id list and calls `reorderSiblingChunks`
- Same pattern optional for project rows within a manual group (`reorderProjectsInGroup`)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/project/ui
git commit -m "Enable HTML5 drag-reorder for sibling project chunks."
```

---

### Task 19: Thin chat surface on main card + append helper

**Files:**
- Modify: `src/modules/shell/ui/panels/shellMainPanel.tsx`
- Create: `src/modules/project/state/projectChat.ts` (append message + touch activity)
- Create: `src/modules/project/state/projectChat.test.ts`
- Modify: `src/modules/shell/ui/shellScreen.test.tsx` if needed

- [ ] **Step 1: Failing `projectChat` test**

```ts
it("appendChunkMessage stores chat and touches activity", () => {
  const { project, chunk } = useProjectStore.getState().createProjectWithRootChunk({
    folderPath: "/work/app",
    nowIso: "2026-01-01T00:00:00.000Z",
  });
  appendChunkMessage({
    chunkId: chunk.id,
    role: "user",
    content: "hello",
    nowIso: "2026-07-10T00:00:00.000Z",
  });
  expect(useChatStore.getState().listMessages(chunk.id)[0]?.content).toBe("hello");
  expect(
    useProjectStore.getState().projects.find((p) => p.id === project.id)?.lastOpenedAt,
  ).toBe("2026-07-10T00:00:00.000Z");
});
```

- [ ] **Step 2: Implement `appendChunkMessage` then chat card UI**

Chat section when `activeMainCard === "chat"`:

- List `useChatStore.listMessages(activeChunkId)`
- Simple form: text input + send button calling `appendChunkMessage`
- If no active chunk, show muted “Select a chunk”

Keep terminal/editor dummy inputs as today.

- [ ] **Step 3: Run related tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add src/modules/project/state/projectChat.ts src/modules/project/state/projectChat.test.ts src/modules/shell/ui/panels/shellMainPanel.tsx
git commit -m "Show and append chat messages for the active project chunk."
```

---

### Task 20: Domain docs + CONTEXT-MAP

**Files:**
- Create: `src/modules/project/CONTEXT.md`
- Create: `src/modules/chat/CONTEXT.md`
- Modify: `CONTEXT-MAP.md`

- [ ] **Step 1: Write CONTEXT files**

`project/CONTEXT.md` terms: Project, ProjectChunk, ProjectGroup, Left Panel navigator, Retention Sweep, Activation. Avoid calling ProjectChunk a “session”.

`chat/CONTEXT.md` terms: ChatMessage, chunk-scoped history.

- [ ] **Step 2: Update CONTEXT-MAP.md table** with `project` and `chat` rows.

- [ ] **Step 3: Commit**

```bash
git add CONTEXT-MAP.md src/modules/project/CONTEXT.md src/modules/chat/CONTEXT.md
git commit -m "Document project and chat domain contexts."
```

---

### Task 21: Full verification

- [ ] **Step 1: Run entire unit suite**

Run: `bun run test`

Expected: PASS

- [ ] **Step 2: Typecheck/build**

Run: `bun run build`

Expected: PASS (`tsc && vite build`)

- [ ] **Step 3: Fix any failures from integration gaps** (sessionRoot tests may need project store reset in `beforeEach`)

- [ ] **Step 4: Final commit only if fixes were needed**

```bash
git add -A
git commit -m "Fix project left-panel integration test fallout."
```

---

## Self-review (plan vs spec)

| Spec requirement | Task(s) |
| --- | --- |
| `project` + `chat` modules, prefixed names | 2–11, 20 |
| Project wraps folder; workspace derived | 11–13 |
| Nested `ProjectChunk` tree | 4, 9, 15 |
| Pin projects/chunks | 9, 15 |
| Auto + manual groups | 5, 17 |
| Search names + messages | 2, 8, 16 |
| 30d retention; pinned exempt; ancestor retain | 6, 10 |
| Manual delete cascade to chat | 10, 15 |
| Migrate existing workspacePath | 7, 12 |
| Restore last main card + writeback | 11, 12 |
| Left panel in shell | 14 |
| Drag-reorder | 18 |
| Full message history | 2, 19 |
| Debug reset clears both | 12 |
| Error: panelError / missing folder re-link | Task 9 (`panelError`); Task 15 Relink button via folder picker |

**Relink** is specified in Task 15 (always-available Relink control; no filesystem probe required in tests).

---

## Execution notes

- Prefer `bun run test <path>` for focused TDD loops; `bun run test` before handoff.
- Do not reference or copy code from repositories outside this workspace.
- Keep commits frequent as listed; do not push unless asked.
`}