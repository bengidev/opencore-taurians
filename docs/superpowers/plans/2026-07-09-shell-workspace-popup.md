# Shell & Workspace Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post-onboarding placeholder with a session-orchestrated shell, workspace popup gate, Zustand + Tauri Store persistence, window resize/recenter, and a debug reset control — styled with Nothing design.

**Architecture:** Internal modules `session`, `shell`, and `workspace-popup` (panels stay inside `shell`). Zustand stores per concern persist through a session-owned Tauri Store `StateStorage` adapter (memory fake in tests). Ports hide Tauri dialog/window APIs. `SessionRoot` routes onboarding ↔ shell, overlays the popup when no workspace path, and owns debug reset + window sizing.

**Tech Stack:** React 19, Zustand 5 (+ persist), Vitest + Testing Library, Tauri 2 (`@tauri-apps/plugin-store`, `@tauri-apps/plugin-dialog`, `@tauri-apps/api` window), Tailwind 4 + existing Nothing tokens / 6px `Button`.

**Spec:** `docs/superpowers/specs/2026-07-09-shell-workspace-popup-design.md`

---

## File structure

### Create

| Path | Responsibility |
| --- | --- |
| `src/modules/session/infrastructure/sessionPersistKeys.ts` | Canonical Zustand persist `name` keys + Tauri store filename |
| `src/modules/session/infrastructure/sessionStateStorage.ts` | `StateStorage` port + `createMemoryStateStorage` + `createTauriStateStorage` |
| `src/modules/session/infrastructure/sessionStateStorage.test.ts` | Storage adapter tests |
| `src/modules/session/infrastructure/sessionPersistStorage.ts` | Factory: `createSessionPersistStorage()` → `createJSONStorage(() => …)` |
| `src/modules/session/infrastructure/sessionWindowController.ts` | `WindowController` port + sizes + memory/Tauri adapters |
| `src/modules/session/infrastructure/sessionWindowController.test.ts` | Window controller tests |
| `src/modules/session/state/sessionStore.ts` | `onboardingCompleted`, `hasHydrated`, `completeOnboarding`, `resetAll` |
| `src/modules/session/state/sessionStore.test.ts` | Session store tests |
| `src/modules/session/ui/sessionDebugResetButton.tsx` | Floating debug reset control |
| `src/modules/session/ui/sessionRoot.tsx` | Boot, route, window sync, compose shell + popup + reset |
| `src/modules/session/ui/sessionRoot.test.tsx` | Session routing / reset tests |
| `src/modules/session/index.ts` | Public seam |
| `src/modules/session/CONTEXT.md` | Domain language |
| `src/modules/shell/state/shellStore.ts` | Active card + left/right visibility |
| `src/modules/shell/state/shellStore.test.ts` | Shell store tests |
| `src/modules/shell/ui/panels/shellLeftPanel.tsx` | Left panel chrome |
| `src/modules/shell/ui/panels/shellRightPanel.tsx` | Right panel chrome |
| `src/modules/shell/ui/panels/shellBottomPanel.tsx` | Bottom panel chrome |
| `src/modules/shell/ui/panels/shellMainPanel.tsx` | Mounted chat/terminal/editor cards + swap |
| `src/modules/shell/ui/shellModeBar.tsx` | Mode segmented control |
| `src/modules/shell/ui/shellScreen.tsx` | Shell layout composition |
| `src/modules/shell/ui/shellScreen.test.tsx` | Shell UI behavior tests |
| `src/modules/shell/index.ts` | Public seam |
| `src/modules/shell/CONTEXT.md` | Domain language |
| `src/modules/workspace-popup/infrastructure/workspaceFolderPicker.ts` | `FolderPicker` port + memory/Tauri adapters |
| `src/modules/workspace-popup/infrastructure/workspaceFolderPicker.test.ts` | Folder picker tests |
| `src/modules/workspace-popup/state/workspaceStore.ts` | `workspacePath` + setters |
| `src/modules/workspace-popup/state/workspaceStore.test.ts` | Workspace store tests |
| `src/modules/workspace-popup/ui/workspacePopup.tsx` | Modal UI + Open project |
| `src/modules/workspace-popup/ui/workspacePopup.test.tsx` | Popup UI tests |
| `src/modules/workspace-popup/index.ts` | Public seam |
| `src/modules/workspace-popup/CONTEXT.md` | Domain language |
| `src/modules/onboarding/state/onboardingThemeStore.ts` | Zustand theme store (replaces repository-driven provider state) |
| `src/modules/onboarding/state/onboardingThemeStore.test.ts` | Theme store tests |
| `public/brand/opencore-logo-dark.png` | Dark logo (copied once) |
| `public/brand/opencore-logo-light.png` | Light logo (copied once) |

### Modify

| Path | Change |
| --- | --- |
| `package.json` | Add `zustand`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-dialog` |
| `src-tauri/Cargo.toml` | Add `tauri-plugin-store`, `tauri-plugin-dialog` |
| `src-tauri/src/lib.rs` | Register store + dialog plugins |
| `src-tauri/capabilities/default.json` | Store, dialog, window setSize/center permissions |
| `src-tauri/tauri.conf.json` | Default window `960` × `680` |
| `src/App.tsx` | Mount `SessionRoot` instead of local `entered` state |
| `src/modules/onboarding/ui/onboardingThemeProvider.tsx` | Thin adapter over `onboardingThemeStore` |
| `src/modules/onboarding/ui/onboardingThemeContext.ts` | Keep `useTheme` API; may read from store |
| `src/modules/onboarding/infrastructure/onboardingThemeRepository.ts` | Keep for boot sync helper or slim to localStorage mirror only |
| `src/modules/onboarding/index.ts` | Export anything session needs (unchanged if possible) |
| `src/test/setup.ts` | Reset Zustand stores between tests if needed |
| `CONTEXT-MAP.md` | Add session / shell / workspace-popup rows |
| `public/theme-boot.js` | Unchanged key `opencore-theme` — theme store dual-writes localStorage for FOUC prevention |

### Theme persistence note

Zustand theme state persists via the shared Tauri Store adapter **and** mirrors `localStorage[opencore-theme]` on every change / hydrate so `public/theme-boot.js` still prevents a flash. Debug reset clears Tauri keys **and** that localStorage key.

---

### Task 1: Dependencies, Tauri plugins, window defaults

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Install JS dependencies**

Run:

```bash
bun add zustand @tauri-apps/plugin-store @tauri-apps/plugin-dialog
```

Expected: packages appear in `package.json` / `bun.lock`.

- [ ] **Step 2: Add Rust plugin crates**

In `src-tauri/Cargo.toml` under `[dependencies]`, add:

```toml
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
```

- [ ] **Step 3: Register plugins in Rust**

Replace `src-tauri/src/lib.rs` plugin setup with:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Update capabilities**

Set `src-tauri/capabilities/default.json` permissions to:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "store:default",
    "dialog:default",
    "core:window:allow-set-size",
    "core:window:allow-center"
  ]
}
```

- [ ] **Step 5: Fix default window size**

In `src-tauri/tauri.conf.json`, set the main window to:

```json
"width": 960,
"height": 680
```

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json src-tauri/tauri.conf.json
git commit -m "$(cat <<'EOF'
Add Zustand and Tauri store/dialog plugins for session persistence.

EOF
)"
```

---

### Task 2: Copy brand logos into the repo

**Files:**
- Create: `public/brand/opencore-logo-dark.png`
- Create: `public/brand/opencore-logo-light.png`

- [ ] **Step 1: Copy assets**

Run:

```bash
mkdir -p public/brand
cp "/Users/beng/Documents/Backup/OpenCore assets/OP EN (4).png" public/brand/opencore-logo-dark.png
cp "/Users/beng/Documents/Backup/OpenCore assets/OP EN (6).png" public/brand/opencore-logo-light.png
```

Expected: both files exist under `public/brand/`.

- [ ] **Step 2: Commit**

```bash
git add public/brand/opencore-logo-dark.png public/brand/opencore-logo-light.png
git commit -m "$(cat <<'EOF'
Add OpenCore brand logos for dark and light modes.

EOF
)"
```

---

### Task 3: Session persist keys + memory/Tauri StateStorage

**Files:**
- Create: `src/modules/session/infrastructure/sessionPersistKeys.ts`
- Create: `src/modules/session/infrastructure/sessionStateStorage.ts`
- Create: `src/modules/session/infrastructure/sessionStateStorage.test.ts`
- Create: `src/modules/session/infrastructure/sessionPersistStorage.ts`

- [ ] **Step 1: Write the failing storage test**

Create `src/modules/session/infrastructure/sessionStateStorage.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  createMemoryStateStorage,
  SESSION_PERSIST_KEYS,
} from "./sessionStateStorage";

describe("createMemoryStateStorage", () => {
  it("round-trips string values by key", async () => {
    const storage = createMemoryStateStorage();
    await storage.setItem(SESSION_PERSIST_KEYS.session, '{"state":{"onboardingCompleted":true}}');
    await expect(storage.getItem(SESSION_PERSIST_KEYS.session)).resolves.toContain(
      "onboardingCompleted",
    );
  });

  it("removes keys", async () => {
    const storage = createMemoryStateStorage();
    await storage.setItem(SESSION_PERSIST_KEYS.workspace, "x");
    await storage.removeItem(SESSION_PERSIST_KEYS.workspace);
    await expect(storage.getItem(SESSION_PERSIST_KEYS.workspace)).resolves.toBeNull();
  });

  it("clearAll removes every known persist key", async () => {
    const storage = createMemoryStateStorage();
    for (const key of Object.values(SESSION_PERSIST_KEYS)) {
      await storage.setItem(key, "1");
    }
    await storage.clearAll();
    for (const key of Object.values(SESSION_PERSIST_KEYS)) {
      await expect(storage.getItem(key)).resolves.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/session/infrastructure/sessionStateStorage.test.ts`

Expected: FAIL (module / exports missing).

- [ ] **Step 3: Implement keys + memory storage**

Create `src/modules/session/infrastructure/sessionPersistKeys.ts`:

```typescript
/** Zustand persist `name` values — keep in sync with resetAll. */
export const SESSION_PERSIST_KEYS = {
  session: "opencore-session",
  workspace: "opencore-workspace",
  shell: "opencore-shell",
  theme: "opencore-theme",
} as const;

export type SessionPersistKey =
  (typeof SESSION_PERSIST_KEYS)[keyof typeof SESSION_PERSIST_KEYS];

/** Tauri plugin-store filename. */
export const SESSION_TAURI_STORE_FILE = "opencore-session.json";
```

Create `src/modules/session/infrastructure/sessionStateStorage.ts`:

```typescript
import type { StateStorage } from "zustand/middleware";
import { SESSION_PERSIST_KEYS, type SessionPersistKey } from "./sessionPersistKeys";

export { SESSION_PERSIST_KEYS, SESSION_TAURI_STORE_FILE } from "./sessionPersistKeys";
export type { SessionPersistKey } from "./sessionPersistKeys";

export interface SessionStateStorage extends StateStorage {
  clearAll(): Promise<void>;
}

export function createMemoryStateStorage(
  initial?: Record<string, string>,
): SessionStateStorage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));

  return {
    getItem: async (name) => map.get(name) ?? null,
    setItem: async (name, value) => {
      map.set(name, value);
    },
    removeItem: async (name) => {
      map.delete(name);
    },
    clearAll: async () => {
      for (const key of Object.values(SESSION_PERSIST_KEYS)) {
        map.delete(key);
      }
    },
  };
}

/** Production adapter — uses Tauri Store under the hood. */
export function createTauriStateStorage(
  loadStore: () => Promise<{
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
    save: () => Promise<void>;
  }>,
): SessionStateStorage {
  let storePromise: ReturnType<typeof loadStore> | null = null;
  const store = () => {
    storePromise ??= loadStore();
    return storePromise;
  };

  return {
    getItem: async (name) => {
      const value = await (await store()).get(name);
      return typeof value === "string" ? value : value == null ? null : JSON.stringify(value);
    },
    setItem: async (name, value) => {
      const s = await store();
      await s.set(name, value);
      await s.save();
    },
    removeItem: async (name) => {
      const s = await store();
      await s.delete(name);
      await s.save();
    },
    clearAll: async () => {
      const s = await store();
      for (const key of Object.values(SESSION_PERSIST_KEYS) as SessionPersistKey[]) {
        await s.delete(key);
      }
      await s.save();
    },
  };
}
```

Create `src/modules/session/infrastructure/sessionPersistStorage.ts`:

```typescript
import { createJSONStorage, type PersistStorage } from "zustand/middleware";
import {
  createMemoryStateStorage,
  createTauriStateStorage,
  type SessionStateStorage,
} from "./sessionStateStorage";
import { SESSION_TAURI_STORE_FILE } from "./sessionPersistKeys";

let activeStorage: SessionStateStorage = createMemoryStateStorage();

/** Test / boot override. Production boot calls `useTauriPersistStorage()`. */
export function setSessionStateStorage(storage: SessionStateStorage): void {
  activeStorage = storage;
}

export function getSessionStateStorage(): SessionStateStorage {
  return activeStorage;
}

export function createSessionPersistStorage<T>(): PersistStorage<T> | undefined {
  return createJSONStorage(() => activeStorage);
}

export async function useTauriPersistStorage(): Promise<SessionStateStorage> {
  const { Store } = await import("@tauri-apps/plugin-store");
  const storage = createTauriStateStorage(() => Store.load(SESSION_TAURI_STORE_FILE));
  setSessionStateStorage(storage);
  return storage;
}

export function useMemoryPersistStorage(
  initial?: Record<string, string>,
): SessionStateStorage {
  const storage = createMemoryStateStorage(initial);
  setSessionStateStorage(storage);
  return storage;
}
```

Fix the test import to pull `SESSION_PERSIST_KEYS` from `./sessionPersistKeys` or re-export (already re-exported from `sessionStateStorage`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/session/infrastructure/sessionStateStorage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/session/infrastructure/
git commit -m "$(cat <<'EOF'
Add session StateStorage adapters for Zustand persistence.

EOF
)"
```

---

### Task 4: Session store (onboardingCompleted + resetAll)

**Files:**
- Create: `src/modules/session/state/sessionStore.ts`
- Create: `src/modules/session/state/sessionStore.test.ts`

- [ ] **Step 1: Write the failing store test**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../infrastructure/sessionPersistStorage";
import { useSessionStore } from "./sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useSessionStore.setState({
      onboardingCompleted: false,
      hasHydrated: true,
    });
  });

  it("starts with onboarding incomplete", () => {
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
  });

  it("completeOnboarding sets the flag", () => {
    useSessionStore.getState().completeOnboarding();
    expect(useSessionStore.getState().onboardingCompleted).toBe(true);
  });

  it("resetSessionFlags clears onboardingCompleted", () => {
    useSessionStore.getState().completeOnboarding();
    useSessionStore.getState().resetSessionFlags();
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/session/state/sessionStore.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement sessionStore**

```typescript
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getSessionStateStorage } from "../infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../infrastructure/sessionPersistKeys";

export interface SessionState {
  onboardingCompleted: boolean;
  hasHydrated: boolean;
  completeOnboarding: () => void;
  resetSessionFlags: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      hasHydrated: false,
      completeOnboarding: () => set({ onboardingCompleted: true }),
      resetSessionFlags: () => set({ onboardingCompleted: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: SESSION_PERSIST_KEYS.session,
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
```

`createJSONStorage(() => getSessionStateStorage())` lets tests swap the adapter in `beforeEach` via `useMemoryPersistStorage()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/session/state/sessionStore.test.ts`

Expected: PASS. If hydration flakes, set `hasHydrated: true` in test setup after `persist.hasHydrated()` or skip async rehydrate in unit tests by not relying on `onRehydrateStorage`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/session/state/
git commit -m "$(cat <<'EOF'
Add session Zustand store for onboarding completion.

EOF
)"
```

---

### Task 5: Workspace store

**Files:**
- Create: `src/modules/workspace-popup/state/workspaceStore.ts`
- Create: `src/modules/workspace-popup/state/workspaceStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useWorkspaceStore } from "./workspaceStore";

describe("workspaceStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useWorkspaceStore.setState({ workspacePath: null });
  });

  it("setWorkspace stores the path", () => {
    useWorkspaceStore.getState().setWorkspace("/tmp/demo");
    expect(useWorkspaceStore.getState().workspacePath).toBe("/tmp/demo");
  });

  it("clearWorkspace removes the path", () => {
    useWorkspaceStore.getState().setWorkspace("/tmp/demo");
    useWorkspaceStore.getState().clearWorkspace();
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun run test src/modules/workspace-popup/state/workspaceStore.test.ts`

- [ ] **Step 3: Implement workspaceStore**

```typescript
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getSessionStateStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";

export interface WorkspaceState {
  workspacePath: string | null;
  setWorkspace: (path: string) => void;
  clearWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspacePath: null,
      setWorkspace: (path) => set({ workspacePath: path }),
      clearWorkspace: () => set({ workspacePath: null }),
    }),
    {
      name: SESSION_PERSIST_KEYS.workspace,
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({ workspacePath: state.workspacePath }),
    },
  ),
);
```

Cross-module import of session infrastructure is allowed for the shared storage factory (session owns persistence). Do not import Tauri from workspace-popup.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/workspace-popup/state/
git commit -m "$(cat <<'EOF'
Add workspace Zustand store for selected folder path.

EOF
)"
```

---

### Task 6: Shell store

**Files:**
- Create: `src/modules/shell/state/shellStore.ts`
- Create: `src/modules/shell/state/shellStore.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "./shellStore";

describe("shellStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
    });
  });

  it("setActiveMainCard switches cards", () => {
    useShellStore.getState().setActiveMainCard("editor");
    expect(useShellStore.getState().activeMainCard).toBe("editor");
  });

  it("toggles left and right independently", () => {
    useShellStore.getState().toggleLeft();
    expect(useShellStore.getState().leftVisible).toBe(false);
    expect(useShellStore.getState().rightVisible).toBe(true);
    useShellStore.getState().toggleRight();
    expect(useShellStore.getState().rightVisible).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement shellStore**

```typescript
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getSessionStateStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";

export type ShellMainCard = "chat" | "terminal" | "editor";

export interface ShellState {
  activeMainCard: ShellMainCard;
  leftVisible: boolean;
  rightVisible: boolean;
  setActiveMainCard: (card: ShellMainCard) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  resetShellUi: () => void;
}

const DEFAULT_SHELL_UI = {
  activeMainCard: "chat" as ShellMainCard,
  leftVisible: true,
  rightVisible: true,
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      ...DEFAULT_SHELL_UI,
      setActiveMainCard: (card) => set({ activeMainCard: card }),
      toggleLeft: () => set((s) => ({ leftVisible: !s.leftVisible })),
      toggleRight: () => set((s) => ({ rightVisible: !s.rightVisible })),
      resetShellUi: () => set({ ...DEFAULT_SHELL_UI }),
    }),
    {
      name: SESSION_PERSIST_KEYS.shell,
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({
        activeMainCard: state.activeMainCard,
        leftVisible: state.leftVisible,
        rightVisible: state.rightVisible,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/state/
git commit -m "$(cat <<'EOF'
Add shell Zustand store for layout and main card state.

EOF
)"
```

---

### Task 7: Theme store refactor (Zustand + localStorage mirror)

**Files:**
- Create: `src/modules/onboarding/state/onboardingThemeStore.ts`
- Create: `src/modules/onboarding/state/onboardingThemeStore.test.ts`
- Modify: `src/modules/onboarding/ui/onboardingThemeProvider.tsx`
- Modify: `src/modules/onboarding/ui/onboardingThemeContext.ts` (if needed)
- Keep: `public/theme-boot.js` key `opencore-theme`

- [ ] **Step 1: Write the failing theme store test**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { THEME_STORAGE_KEY } from "../infrastructure/onboardingThemeConstants";
import { useThemeStore } from "./onboardingThemeStore";

describe("onboardingThemeStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    localStorage.clear();
    useThemeStore.setState({ mode: "dark" });
  });

  it("toggle switches light and dark", () => {
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe("light");
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe("dark");
  });

  it("mirrors mode to localStorage for theme-boot", () => {
    useThemeStore.getState().setMode("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement theme store + thin provider**

`onboardingThemeStore.ts`:

```typescript
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  applyThemeToDocument,
  DEFAULT_THEME_MODE,
  nextThemeMode,
  type ThemeMode,
} from "../domain/onboardingTheme";
import { THEME_STORAGE_KEY } from "../infrastructure/onboardingThemeConstants";
import { getSessionStateStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";

function mirrorLocalStorage(mode: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  applyThemeToDocument(mode);
}

export interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  resetTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: DEFAULT_THEME_MODE,
      setMode: (mode) => {
        mirrorLocalStorage(mode);
        set({ mode });
      },
      toggle: () => {
        const mode = nextThemeMode(get().mode);
        mirrorLocalStorage(mode);
        set({ mode });
      },
      resetTheme: () => {
        mirrorLocalStorage(DEFAULT_THEME_MODE);
        set({ mode: DEFAULT_THEME_MODE });
      },
    }),
    {
      name: SESSION_PERSIST_KEYS.theme,
      storage: createJSONStorage(() => getSessionStateStorage()),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) mirrorLocalStorage(state.mode);
      },
    },
  ),
);
```

Rewrite `onboardingThemeProvider.tsx` to subscribe to the store (no `useState` repository path for mode). Keep exporting `ThemeProvider` / `useTheme` from the public seam. Example provider:

```tsx
import { useEffect, type ReactNode } from "react";
import { ThemeContext } from "./onboardingThemeContext";
import { useThemeStore } from "../state/onboardingThemeStore";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  useEffect(() => {
    // store already mirrors; ensure document class on mount
    useThemeStore.getState().setMode(mode);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

Prefer a cleaner mount effect that only calls `applyThemeToDocument(mode)` to avoid loops — match existing tests in `onboardingThemeRepository.test.ts` / screen tests; update repository tests if the repository is no longer the source of truth (keep repository file as a thin localStorage helper or delete unused paths and update tests).

- [ ] **Step 4: Run theme + onboarding tests**

Run:

```bash
bun run test src/modules/onboarding/
```

Expected: PASS (update any broken repository-centric tests to target the store).

- [ ] **Step 5: Commit**

```bash
git add src/modules/onboarding/
git commit -m "$(cat <<'EOF'
Refactor onboarding theme state onto Zustand with boot mirror.

EOF
)"
```

---

### Task 8: `resetAll` orchestration helper

**Files:**
- Create: `src/modules/session/state/sessionReset.ts`
- Create: `src/modules/session/state/sessionReset.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage, getSessionStateStorage } from "../infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../infrastructure/sessionPersistKeys";
import { useSessionStore } from "./sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useShellStore } from "../../shell/state/shellStore";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { THEME_STORAGE_KEY } from "../../onboarding/infrastructure/onboardingThemeConstants";
import { resetAllPersistedSession } from "./sessionReset";

describe("resetAllPersistedSession", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useSessionStore.setState({ onboardingCompleted: true });
    useWorkspaceStore.setState({ workspacePath: "/tmp/x" });
    useShellStore.setState({
      activeMainCard: "editor",
      leftVisible: false,
      rightVisible: false,
    });
    useThemeStore.getState().setMode("light");
  });

  it("clears stores, storage keys, and theme localStorage", async () => {
    await resetAllPersistedSession();
    expect(useSessionStore.getState().onboardingCompleted).toBe(false);
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
    expect(useShellStore.getState().activeMainCard).toBe("chat");
    expect(useShellStore.getState().leftVisible).toBe(true);
    expect(useThemeStore.getState().mode).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    const storage = getSessionStateStorage();
    for (const key of Object.values(SESSION_PERSIST_KEYS)) {
      await expect(storage.getItem(key)).resolves.toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement reset helper**

```typescript
import { getSessionStateStorage } from "../infrastructure/sessionPersistStorage";
import { useSessionStore } from "./sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useShellStore } from "../../shell/state/shellStore";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { THEME_STORAGE_KEY } from "../../onboarding/infrastructure/onboardingThemeConstants";

export async function resetAllPersistedSession(): Promise<void> {
  await getSessionStateStorage().clearAll();
  localStorage.removeItem(THEME_STORAGE_KEY);
  useSessionStore.getState().resetSessionFlags();
  useWorkspaceStore.getState().clearWorkspace();
  useShellStore.getState().resetShellUi();
  useThemeStore.getState().resetTheme();
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/session/state/sessionReset.ts src/modules/session/state/sessionReset.test.ts
git commit -m "$(cat <<'EOF'
Add session reset that clears all persisted app state.

EOF
)"
```

---

### Task 9: WindowController port

**Files:**
- Create: `src/modules/session/infrastructure/sessionWindowController.ts`
- Create: `src/modules/session/infrastructure/sessionWindowController.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_WINDOW_SIZE,
  SHELL_WINDOW_SIZE,
  createMemoryWindowController,
} from "./sessionWindowController";

describe("createMemoryWindowController", () => {
  it("records resize and center for onboarding size", async () => {
    const controller = createMemoryWindowController();
    await controller.applyOnboardingSize();
    expect(controller.lastSize).toEqual(ONBOARDING_WINDOW_SIZE);
    expect(controller.centerCount).toBe(1);
  });

  it("records resize and center for shell size", async () => {
    const controller = createMemoryWindowController();
    await controller.applyShellSize();
    expect(controller.lastSize).toEqual(SHELL_WINDOW_SIZE);
    expect(controller.centerCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement port + adapters**

```typescript
export interface WindowSize {
  width: number;
  height: number;
}

export const ONBOARDING_WINDOW_SIZE: WindowSize = { width: 960, height: 680 };
export const SHELL_WINDOW_SIZE: WindowSize = { width: 1280, height: 800 };

export interface WindowController {
  applyOnboardingSize(): Promise<void>;
  applyShellSize(): Promise<void>;
}

export interface MemoryWindowController extends WindowController {
  lastSize: WindowSize | null;
  centerCount: number;
}

export function createMemoryWindowController(): MemoryWindowController {
  const controller: MemoryWindowController = {
    lastSize: null,
    centerCount: 0,
    async applyOnboardingSize() {
      controller.lastSize = { ...ONBOARDING_WINDOW_SIZE };
      controller.centerCount += 1;
    },
    async applyShellSize() {
      controller.lastSize = { ...SHELL_WINDOW_SIZE };
      controller.centerCount += 1;
    },
  };
  return controller;
}

export function createTauriWindowController(): WindowController {
  return {
    async applyOnboardingSize() {
      await resizeAndCenter(ONBOARDING_WINDOW_SIZE);
    },
    async applyShellSize() {
      await resizeAndCenter(SHELL_WINDOW_SIZE);
    },
  };
}

async function resizeAndCenter(size: WindowSize): Promise<void> {
  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  await window.setSize(new LogicalSize(size.width, size.height));
  await window.center();
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/session/infrastructure/sessionWindowController.ts src/modules/session/infrastructure/sessionWindowController.test.ts
git commit -m "$(cat <<'EOF'
Add window controller port for onboarding and shell sizes.

EOF
)"
```

---

### Task 10: FolderPicker port

**Files:**
- Create: `src/modules/workspace-popup/infrastructure/workspaceFolderPicker.ts`
- Create: `src/modules/workspace-popup/infrastructure/workspaceFolderPicker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { createMemoryFolderPicker } from "./workspaceFolderPicker";

describe("createMemoryFolderPicker", () => {
  it("returns the configured path", async () => {
    const picker = createMemoryFolderPicker("/Users/demo/project");
    await expect(picker.pickFolder()).resolves.toBe("/Users/demo/project");
  });

  it("returns null when cancelled", async () => {
    const picker = createMemoryFolderPicker(null);
    await expect(picker.pickFolder()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```typescript
export interface FolderPicker {
  pickFolder(): Promise<string | null>;
}

export function createMemoryFolderPicker(
  result: string | null,
): FolderPicker {
  return {
    async pickFolder() {
      return result;
    },
  };
}

export function createTauriFolderPicker(): FolderPicker {
  return {
    async pickFolder() {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected === null) return null;
      if (Array.isArray(selected)) return selected[0] ?? null;
      return selected;
    },
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/workspace-popup/infrastructure/
git commit -m "$(cat <<'EOF'
Add folder picker port for workspace selection.

EOF
)"
```

---

### Task 11: Shell UI (Nothing chrome + preserved main cards)

**Files:**
- Create: `src/modules/shell/ui/panels/shellLeftPanel.tsx`
- Create: `src/modules/shell/ui/panels/shellRightPanel.tsx`
- Create: `src/modules/shell/ui/panels/shellBottomPanel.tsx`
- Create: `src/modules/shell/ui/panels/shellMainPanel.tsx`
- Create: `src/modules/shell/ui/shellModeBar.tsx`
- Create: `src/modules/shell/ui/shellScreen.tsx`
- Create: `src/modules/shell/ui/shellScreen.test.tsx`
- Create: `src/modules/shell/index.ts`
- Create: `src/modules/shell/CONTEXT.md`

- [ ] **Step 1: Write the failing UI test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../state/shellStore";
import { ShellScreen } from "./shellScreen";

describe("ShellScreen", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
    });
  });

  it("keeps inactive main cards mounted while swapping", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    const chatInput = screen.getByLabelText("chat-dummy-note");
    await user.type(chatInput, "kept");
    await user.click(screen.getByRole("button", { name: /terminal/i }));
    await user.click(screen.getByRole("button", { name: /chat/i }));
    expect(chatInput).toHaveValue("kept");
  });

  it("hides left and right panels independently", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    expect(screen.getByLabelText("left panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /toggle left/i }));
    expect(screen.queryByLabelText("left panel")).not.toBeInTheDocument();
    expect(screen.getByLabelText("right panel")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement shell UI**

Nothing rules: Space Mono ALL CAPS labels, 6px radius controls (use shared `Button`), flat borders, no shadows, no capsules. Structure:

- `shellModeBar.tsx` — three buttons bound to `setActiveMainCard`
- `shellMainPanel.tsx` — three sections always mounted; inactive use `hidden` + `aria-hidden`; each has a labeled dummy `<input aria-label="{card}-dummy-note" />`
- side/bottom panels — bordered regions with Space Mono labels
- `shellScreen.tsx` — CSS grid: mode bar; row with left | main | right; bottom bar; toggle buttons for left/right in the mode bar or chrome

Example main panel pattern:

```tsx
<div className="relative min-h-0 flex-1">
  {(["chat", "terminal", "editor"] as const).map((card) => (
    <section
      key={card}
      hidden={activeMainCard !== card}
      aria-hidden={activeMainCard !== card}
      className="absolute inset-0 p-3"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {card}
      </p>
      <input aria-label={`${card}-dummy-note`} className="mt-2 w-full border border-border bg-transparent px-2 py-1 text-sm" />
    </section>
  ))}
</div>
```

`index.ts`:

```typescript
export { ShellScreen } from "./ui/shellScreen";
```

`CONTEXT.md` — define Shell, Main Card, Left/Right/Bottom Panel terms.

- [ ] **Step 4: Run test — expect PASS**

Run: `bun run test src/modules/shell/`

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/
git commit -m "$(cat <<'EOF'
Add Nothing-styled shell layout with state-preserving main cards.

EOF
)"
```

---

### Task 12: Workspace popup UI

**Files:**
- Create: `src/modules/workspace-popup/ui/workspacePopup.tsx`
- Create: `src/modules/workspace-popup/ui/workspacePopup.test.tsx`
- Create: `src/modules/workspace-popup/index.ts`
- Create: `src/modules/workspace-popup/CONTEXT.md`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../onboarding";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useWorkspaceStore } from "../state/workspaceStore";
import { createMemoryFolderPicker } from "../infrastructure/workspaceFolderPicker";
import { WorkspacePopup } from "./workspacePopup";

describe("WorkspacePopup", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useWorkspaceStore.setState({ workspacePath: null });
  });

  it("sets workspace path when Open project succeeds", async () => {
    const user = userEvent.setup();
    const onOpened = vi.fn();
    render(
      <ThemeProvider>
        <WorkspacePopup
          folderPicker={createMemoryFolderPicker("/tmp/opened")}
          onWorkspaceOpened={onOpened}
        />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /open project/i }));
    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspacePath).toBe("/tmp/opened");
    });
    expect(onOpened).toHaveBeenCalledOnce();
  });

  it("leaves path null when picker cancels", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <WorkspacePopup folderPicker={createMemoryFolderPicker(null)} />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /open project/i }));
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });

  it("marks non-open actions as disabled", () => {
    render(
      <ThemeProvider>
        <WorkspacePopup folderPicker={createMemoryFolderPicker(null)} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: /new file/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement popup**

Requirements:
- Modal overlay (`fixed inset-0`), dimmed backdrop, centered panel ~max-w aligned to sketch
- Logo: `src={mode === "dark" ? "/brand/opencore-logo-dark.png" : "/brand/opencore-logo-light.png"}` via `useTheme()`
- Copy exactly from spec
- Get started list; only Open project calls `folderPicker.pickFolder()` then `setWorkspace`
- On cancel: no change; on I/O throw: show inline `[ERROR: …]`
- Enter animation: `scale(0.95)` + opacity, ~200–250ms ease-out, `prefers-reduced-motion` safe
- No dismiss control without workspace

`index.ts` exports `WorkspacePopup` and types for props (`folderPicker?` defaulting to Tauri picker in production composition).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/modules/workspace-popup/
git commit -m "$(cat <<'EOF'
Add workspace popup with Open project folder picking.

EOF
)"
```

---

### Task 13: SessionRoot + debug reset + App wiring

**Files:**
- Create: `src/modules/session/ui/sessionDebugResetButton.tsx`
- Create: `src/modules/session/ui/sessionRoot.tsx`
- Create: `src/modules/session/ui/sessionRoot.test.tsx`
- Create: `src/modules/session/index.ts`
- Create: `src/modules/session/CONTEXT.md`
- Modify: `src/App.tsx`
- Modify: `CONTEXT-MAP.md`

- [ ] **Step 1: Write the failing SessionRoot test**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, OnboardingScreen } from "../../onboarding";
import { useMemoryPersistStorage } from "../infrastructure/sessionPersistStorage";
import { createMemoryWindowController } from "../infrastructure/sessionWindowController";
import { useSessionStore } from "../state/sessionStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { SessionRoot } from "./sessionRoot";

describe("SessionRoot", () => {
  const windowController = createMemoryWindowController();

  beforeEach(() => {
    useMemoryPersistStorage();
    useSessionStore.setState({
      onboardingCompleted: false,
      hasHydrated: true,
    });
    useWorkspaceStore.setState({ workspacePath: null });
    windowController.lastSize = null;
    windowController.centerCount = 0;
  });

  it("shows onboarding until completed", () => {
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: /enter/i })).toBeInTheDocument();
  });

  it("shows shell and workspace popup after onboarding without workspace", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /enter/i }));
    await waitFor(() => {
      expect(windowController.lastSize).toEqual({ width: 1280, height: 800 });
    });
    expect(screen.getByText(/welcome back to/i)).toBeInTheDocument();
  });

  it("reset returns to onboarding and onboarding window size", async () => {
    const user = userEvent.setup();
    useSessionStore.setState({ onboardingCompleted: true, hasHydrated: true });
    useWorkspaceStore.setState({ workspacePath: "/tmp/x" });
    render(
      <ThemeProvider>
        <SessionRoot windowController={windowController} />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /reset persisted data/i }));
    await waitFor(() => {
      expect(useSessionStore.getState().onboardingCompleted).toBe(false);
      expect(windowController.lastSize).toEqual({ width: 960, height: 680 });
    });
  });
});
```

Adjust accessible names to match real onboarding primary button label (read `onboardingScreen.tsx` and use the same name).

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement SessionRoot, debug button, seam, App**

`sessionRoot.tsx` responsibilities:
1. On mount (browser/Tauri): if not in test, `await useTauriPersistStorage()` then wait for store hydrations (`hasHydrated` / `persist.rehydrate()`).
2. If `!hasHydrated`, render `[LOADING...]` inline (Nothing style).
3. If `!onboardingCompleted` → `<OnboardingScreen onEnter={() => { completeOnboarding(); void windowController.applyShellSize(); }} />` and ensure onboarding size applied once on that branch.
4. Else → `<ShellScreen />` + if `!workspacePath` → `<WorkspacePopup />`.
5. Always render `<SessionDebugResetButton />` floating (fixed bottom-right, 6px button, label “Reset persisted data”).
6. Reset handler: `await resetAllPersistedSession(); await windowController.applyOnboardingSize();`

`App.tsx`:

```tsx
import { ThemeProvider } from "./modules/onboarding";
import { SessionRoot } from "./modules/session";

function App() {
  return (
    <ThemeProvider>
      <SessionRoot />
    </ThemeProvider>
  );
}

export default App;
```

Production defaults inside `SessionRoot`: `windowController = createTauriWindowController()`, popup uses `createTauriFolderPicker()`.

Update `CONTEXT-MAP.md` with session / shell / workspace-popup rows.

- [ ] **Step 4: Run focused + full tests**

```bash
bun run test src/modules/session/
bun run test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/session/ src/App.tsx CONTEXT-MAP.md
git commit -m "$(cat <<'EOF'
Wire session root for onboarding, shell, popup, and debug reset.

EOF
)"
```

---

### Task 14: Manual Tauri smoke + polish pass

**Files:** (touch only if smoke finds gaps — shell/popup CSS, motion, reduced-motion)

- [ ] **Step 1: Run unit suite green**

```bash
bun run test
bun run build
```

Expected: PASS / build succeeds.

- [ ] **Step 2: Dev smoke (human or agent with Tauri)**

```bash
bun run tauri dev
```

Checklist:
- First launch → onboarding at 960×680
- Enter → shell 1280×800 centered; popup visible
- Open project → real folder → popup gone; path survives reload
- Left/right toggles independent; main card text survives swap
- Theme toggle still works; reload keeps theme
- Debug reset → onboarding + cleared data

- [ ] **Step 3: Fix any gaps found; commit if needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Polish shell and workspace popup after Tauri smoke.

EOF
)"
```

Only commit if there are real fixes.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Session module orchestration | 13 |
| Shell base + internal panels | 11 |
| Workspace popup module | 12 |
| Zustand stores | 4–7 |
| Tauri Store persistence adapter | 3 |
| FolderPicker / WindowController ports | 9–10 |
| Open project only live | 12 |
| Main cards preserve state | 11 |
| Left/right independent | 11 |
| Window 960×680 / 1280×800 + center | 1, 9, 13 |
| Debug reset all persistence | 8, 13 |
| Nothing + 6px buttons | 11–13 |
| Logo assets in repo | 2 |
| Theme Zustand + boot mirror | 7 |
| TDD | all feature tasks |
| Granular commits | each task Step 5 |
| CONTEXT-MAP / module CONTEXT | 11–13 |

## Type / name consistency

- Persist keys: `opencore-session` | `opencore-workspace` | `opencore-shell` | `opencore-theme`
- Window sizes: `ONBOARDING_WINDOW_SIZE` `{960,680}`, `SHELL_WINDOW_SIZE` `{1280,800}`
- Cards: `"chat" | "terminal" | "editor"`
- Reset entrypoint: `resetAllPersistedSession()`
- Storage swap: `useMemoryPersistStorage()` / `useTauriPersistStorage()` + `getSessionStateStorage()`
- Logos: `/brand/opencore-logo-dark.png`, `/brand/opencore-logo-light.png`
