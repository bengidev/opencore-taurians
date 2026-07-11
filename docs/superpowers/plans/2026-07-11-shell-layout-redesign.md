# Shell Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-layout the workspace shell so the center column owns main-card tabs, the main panel, and the bottom panel; sidebars use dual-host panel toggles and a settings sheet exposes theme + panel preferences.

**Architecture:** Extend `shellStore` with explicit visibility setters and width reset. Replace the three-row `ShellScreen` grid with a single row of animated side slots + `ShellCenterColumn`. Extract toggles into `ShellPanelToggle` (panel header when open, `ShellMainCardTabs` when closed). Add shadcn `sheet`/`switch`/`label` primitives for `ShellSettingsSheet`.

**Tech Stack:** React 19, Zustand persist, Vitest + Testing Library, Tailwind 4, `@base-ui/react`, shadcn (base-nova), lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-11-shell-layout-redesign-design.md`

---

## File structure

### Create

| File | Responsibility |
| --- | --- |
| `src/modules/shell/state/shellStore.test.ts` | Store setter + reset width tests |
| `src/modules/shell/ui/shellPanelToggle.tsx` | Shared left/right panel toggle button |
| `src/modules/shell/ui/shellPanelToggle.test.tsx` | Toggle label + action tests |
| `src/modules/shell/ui/shellPanelSlot.tsx` | Width collapse animation wrapper |
| `src/modules/shell/ui/shellMainCardTabs.tsx` | Center-column tab bar + closed-panel toggles |
| `src/modules/shell/ui/shellCenterColumn.tsx` | Tabs + main + bottom sub-grid |
| `src/modules/shell/ui/panels/shellLeftPanelHeader.tsx` | Left panel header with hide toggle |
| `src/modules/shell/ui/panels/shellRightPanelHeader.tsx` | Right panel header with hide toggle |
| `src/modules/shell/ui/shellSettingsSheet.tsx` | Settings sheet (theme + panels) |
| `src/modules/shell/ui/shellSettingsSheet.test.tsx` | Settings interaction tests |
| `src/components/ui/sheet.tsx` | Sheet primitive (via shadcn CLI) |
| `src/components/ui/switch.tsx` | Switch primitive (via shadcn CLI) |
| `src/components/ui/label.tsx` | Label primitive (via shadcn CLI) |

### Modify

| File | Change |
| --- | --- |
| `src/modules/shell/state/shellStore.ts` | `setLeftVisible`, `setRightVisible`, `resetPanelWidths` |
| `src/modules/shell/ui/shellScreen.tsx` | Single-row grid, animated slots, center column |
| `src/modules/shell/ui/panels/shellLeftPanel.tsx` | Insert left panel header |
| `src/modules/shell/ui/panels/shellRightPanel.tsx` | Insert right panel header |
| `src/modules/shell/ui/panels/shellBottomPanel.tsx` | Settings button + sheet host |
| `src/modules/shell/ui/panels/shellMainPanel.tsx` | Remove side borders (center column owns chrome) |
| `src/modules/shell/ui/shellScreen.test.tsx` | Updated toggle selectors + bottom panel scope |
| `src/modules/project/index.ts` | Export `PanelToolButton` |
| `src/modules/shell/CONTEXT.md` | Replace Mode Bar terminology |

### Delete

| File | Reason |
| --- | --- |
| `src/modules/shell/ui/shellModeBar.tsx` | Replaced by `ShellMainCardTabs` inside center column |

---

### Task 1: Extend `shellStore`

**Files:**
- Modify: `src/modules/shell/state/shellStore.ts`
- Create: `src/modules/shell/state/shellStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/modules/shell/state/shellStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { DEFAULT_SHELL_PANEL_WIDTH } from "./shellPanelSizing";
import { useShellStore } from "./shellStore";

describe("shellStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      activeMainCard: "chat",
      leftVisible: true,
      rightVisible: true,
      leftPanelWidth: 300,
      rightPanelWidth: 300,
    });
  });

  it("setLeftVisible sets visibility without toggling", () => {
    useShellStore.getState().setLeftVisible(false);
    expect(useShellStore.getState().leftVisible).toBe(false);
    useShellStore.getState().setLeftVisible(true);
    expect(useShellStore.getState().leftVisible).toBe(true);
  });

  it("setRightVisible sets visibility without toggling", () => {
    useShellStore.getState().setRightVisible(false);
    expect(useShellStore.getState().rightVisible).toBe(false);
  });

  it("resetPanelWidths restores defaults without touching visibility or main card", () => {
    useShellStore.setState({
      activeMainCard: "editor",
      leftVisible: false,
      rightVisible: true,
      leftPanelWidth: 400,
      rightPanelWidth: 350,
    });
    useShellStore.getState().resetPanelWidths();
    const state = useShellStore.getState();
    expect(state.leftPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
    expect(state.rightPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
    expect(state.leftVisible).toBe(false);
    expect(state.activeMainCard).toBe("editor");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/shell/state/shellStore.test.ts`

Expected: FAIL — `setLeftVisible is not a function`

- [ ] **Step 3: Implement store methods**

Update `src/modules/shell/state/shellStore.ts` interface and implementation:

```ts
export interface ShellState {
  activeMainCard: ShellMainCard;
  leftVisible: boolean;
  rightVisible: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;
  setActiveMainCard: (card: ShellMainCard) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setLeftVisible: (visible: boolean) => void;
  setRightVisible: (visible: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  resetPanelWidths: () => void;
  resetShellUi: () => void;
}
```

Inside the `create` callback, add:

```ts
setLeftVisible: (visible) => set({ leftVisible: visible }),
setRightVisible: (visible) => set({ rightVisible: visible }),
resetPanelWidths: () =>
  set({
    leftPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
    rightPanelWidth: DEFAULT_SHELL_PANEL_WIDTH,
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/shell/state/shellStore.test.ts`

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/state/shellStore.ts src/modules/shell/state/shellStore.test.ts
git commit -m "Add shell store visibility setters and panel width reset."
```

---

### Task 2: Export `PanelToolButton` from project module

**Files:**
- Modify: `src/modules/project/index.ts`

- [ ] **Step 1: Add export**

Append to `src/modules/project/index.ts`:

```ts
export { PanelToolButton } from "./ui/panelToolButton";
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/project/index.ts
git commit -m "Export PanelToolButton from project module."
```

---

### Task 3: `ShellPanelToggle`

**Files:**
- Create: `src/modules/shell/ui/shellPanelToggle.tsx`
- Create: `src/modules/shell/ui/shellPanelToggle.test.tsx`

- [ ] **Step 1: Write failing toggle tests**

Create `src/modules/shell/ui/shellPanelToggle.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useShellStore } from "../state/shellStore";
import { ShellPanelToggle } from "./shellPanelToggle";

describe("ShellPanelToggle", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({ leftVisible: true, rightVisible: true });
  });

  it("shows hide label when left panel is open", () => {
    render(<ShellPanelToggle side="left" />);
    expect(screen.getByRole("button", { name: "Hide left panel" })).toBeInTheDocument();
  });

  it("shows show label when left panel is closed", () => {
    useShellStore.setState({ leftVisible: false });
    render(<ShellPanelToggle side="left" />);
    expect(screen.getByRole("button", { name: "Show left panel" })).toBeInTheDocument();
  });

  it("toggles right panel visibility", async () => {
    const user = userEvent.setup();
    render(<ShellPanelToggle side="right" />);
    await user.click(screen.getByRole("button", { name: "Hide right panel" }));
    expect(useShellStore.getState().rightVisible).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/shell/ui/shellPanelToggle.test.tsx`

Expected: FAIL — module not found

- [ ] **Step 3: Implement `ShellPanelToggle`**

Create `src/modules/shell/ui/shellPanelToggle.tsx`:

```tsx
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { PanelToolButton } from "../../project";
import { useShellStore } from "../state/shellStore";

type ShellPanelSide = "left" | "right";

const PANEL_TOGGLE_META = {
  left: {
    hideLabel: "Hide left panel",
    showLabel: "Show left panel",
    CloseIcon: PanelLeftClose,
    OpenIcon: PanelLeftOpen,
    selectVisible: (s: ReturnType<typeof useShellStore.getState>) => s.leftVisible,
    toggle: (s: ReturnType<typeof useShellStore.getState>) => s.toggleLeft,
  },
  right: {
    hideLabel: "Hide right panel",
    showLabel: "Show right panel",
    CloseIcon: PanelRightClose,
    OpenIcon: PanelRightOpen,
    selectVisible: (s: ReturnType<typeof useShellStore.getState>) => s.rightVisible,
    toggle: (s: ReturnType<typeof useShellStore.getState>) => s.toggleRight,
  },
} as const;

export function ShellPanelToggle({ side }: { side: ShellPanelSide }) {
  const visible = useShellStore(PANEL_TOGGLE_META[side].selectVisible);
  const toggle = useShellStore((s) => PANEL_TOGGLE_META[side].toggle(s));
  const label = visible
    ? PANEL_TOGGLE_META[side].hideLabel
    : PANEL_TOGGLE_META[side].showLabel;
  const Icon = visible
    ? PANEL_TOGGLE_META[side].CloseIcon
    : PANEL_TOGGLE_META[side].OpenIcon;

  return (
    <PanelToolButton label={label} onClick={toggle}>
      <Icon className="size-3.5" />
    </PanelToolButton>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/shell/ui/shellPanelToggle.test.tsx`

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/ui/shellPanelToggle.tsx src/modules/shell/ui/shellPanelToggle.test.tsx
git commit -m "Add shared shell panel toggle control."
```

---

### Task 4: Panel headers

**Files:**
- Create: `src/modules/shell/ui/panels/shellLeftPanelHeader.tsx`
- Create: `src/modules/shell/ui/panels/shellRightPanelHeader.tsx`
- Modify: `src/modules/shell/ui/panels/shellLeftPanel.tsx`
- Modify: `src/modules/shell/ui/panels/shellRightPanel.tsx`

- [ ] **Step 1: Create panel headers**

Create `src/modules/shell/ui/panels/shellLeftPanelHeader.tsx`:

```tsx
import { useShellStore } from "../../state/shellStore";
import { ShellPanelToggle } from "../shellPanelToggle";

export function ShellLeftPanelHeader() {
  const leftVisible = useShellStore((s) => s.leftVisible);
  if (!leftVisible) return null;

  return (
    <header className="flex h-9 shrink-0 items-center border-b border-border px-2">
      <ShellPanelToggle side="left" />
    </header>
  );
}
```

Create `src/modules/shell/ui/panels/shellRightPanelHeader.tsx`:

```tsx
import { useShellStore } from "../../state/shellStore";
import { ShellPanelToggle } from "../shellPanelToggle";

export function ShellRightPanelHeader() {
  const rightVisible = useShellStore((s) => s.rightVisible);
  if (!rightVisible) return null;

  return (
    <header className="flex h-9 shrink-0 items-center justify-end border-b border-border px-2">
      <ShellPanelToggle side="right" />
    </header>
  );
}
```

- [ ] **Step 2: Wire headers into panels**

Update `src/modules/shell/ui/panels/shellLeftPanel.tsx` imports and JSX:

```tsx
import { ShellLeftPanelHeader } from "./shellLeftPanelHeader";
```

Insert `<ShellLeftPanelHeader />` immediately before `<ProjectLeftPanel />`.

Update `src/modules/shell/ui/panels/shellRightPanel.tsx`:

```tsx
import { ShellRightPanelHeader } from "./shellRightPanelHeader";
```

Replace the static label `<p>Right Panel</p>` block with:

```tsx
<ShellRightPanelHeader />
<p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
  Right Panel
</p>
```

- [ ] **Step 3: Run shell tests (still on old layout)**

Run: `bun run test src/modules/shell/ui/shellScreen.test.tsx`

Expected: PASS (layout not changed yet; headers are additive)

- [ ] **Step 4: Commit**

```bash
git add src/modules/shell/ui/panels/shellLeftPanelHeader.tsx \
  src/modules/shell/ui/panels/shellRightPanelHeader.tsx \
  src/modules/shell/ui/panels/shellLeftPanel.tsx \
  src/modules/shell/ui/panels/shellRightPanel.tsx
git commit -m "Add panel headers with hide toggles."
```

---

### Task 5: Center column tab bar

**Files:**
- Create: `src/modules/shell/ui/shellMainCardTabs.tsx`

- [ ] **Step 1: Create `ShellMainCardTabs`**

Create `src/modules/shell/ui/shellMainCardTabs.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { useShellStore, type ShellMainCard } from "../state/shellStore";
import { ShellPanelToggle } from "./shellPanelToggle";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

export function ShellMainCardTabs() {
  const activeMainCard = useShellStore((s) => s.activeMainCard);
  const setActiveMainCard = useShellStore((s) => s.setActiveMainCard);
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);

  return (
    <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2">
      <div className="flex min-w-0 items-center gap-1">
        {!leftVisible ? <ShellPanelToggle side="left" /> : null}
      </div>
      <div className="flex items-center gap-1">
        {MAIN_CARDS.map((card) => (
          <Button
            key={card}
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={activeMainCard === card}
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            onClick={() => setActiveMainCard(card)}
          >
            {card}
          </Button>
        ))}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1">
        {!rightVisible ? <ShellPanelToggle side="right" /> : null}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/shell/ui/shellMainCardTabs.tsx
git commit -m "Add center-column main card tab bar."
```

---

### Task 6: Center column wrapper + main panel border tweak

**Files:**
- Create: `src/modules/shell/ui/shellCenterColumn.tsx`
- Modify: `src/modules/shell/ui/panels/shellMainPanel.tsx`

- [ ] **Step 1: Create `ShellCenterColumn`**

Create `src/modules/shell/ui/shellCenterColumn.tsx`:

```tsx
import { ShellBottomPanel } from "./panels/shellBottomPanel";
import { ShellMainPanel } from "./panels/shellMainPanel";
import { ShellMainCardTabs } from "./shellMainCardTabs";

export function ShellCenterColumn() {
  return (
    <div className="grid min-h-0 min-w-0 grid-rows-[auto_1fr_auto]">
      <ShellMainCardTabs />
      <ShellMainPanel />
      <ShellBottomPanel />
    </div>
  );
}
```

- [ ] **Step 2: Remove side borders from main panel**

In `src/modules/shell/ui/panels/shellMainPanel.tsx`, change the `<main>` className from:

```tsx
className="relative min-h-0 flex-1 border-x border-border bg-background"
```

to:

```tsx
className="relative min-h-0 flex-1 bg-background"
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/shell/ui/shellCenterColumn.tsx src/modules/shell/ui/panels/shellMainPanel.tsx
git commit -m "Add center column wrapper and simplify main panel chrome."
```

---

### Task 7: Animated panel slot

**Files:**
- Create: `src/modules/shell/ui/shellPanelSlot.tsx`

- [ ] **Step 1: Create collapse animation wrapper**

Create `src/modules/shell/ui/shellPanelSlot.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react";

type ShellPanelSlotProps = {
  visible: boolean;
  width: number;
  children: ReactNode;
};

export function ShellPanelSlot({ visible, width, children }: ShellPanelSlotProps) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  if (!mounted) return null;

  const displayWidth = visible ? width : 0;

  return (
    <div
      className="min-h-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ width: displayWidth }}
      onTransitionEnd={(event) => {
        if (event.propertyName === "width" && !visible) {
          setMounted(false);
        }
      }}
    >
      <div className="h-full" style={{ width }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/shell/ui/shellPanelSlot.tsx
git commit -m "Add animated shell panel width slot."
```

---

### Task 8: Rewire `ShellScreen` and remove mode bar

**Files:**
- Modify: `src/modules/shell/ui/shellScreen.tsx`
- Delete: `src/modules/shell/ui/shellModeBar.tsx`
- Modify: `src/modules/shell/ui/shellScreen.test.tsx`

- [ ] **Step 1: Update failing shell screen tests**

In `src/modules/shell/ui/shellScreen.test.tsx`, replace the panel toggle test:

```tsx
  it("hides left and right panels independently", async () => {
    const user = userEvent.setup();
    render(<ShellScreen />);
    expect(screen.getByLabelText("left panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide left panel" }));
    expect(screen.queryByLabelText("left panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show left panel" })).toBeInTheDocument();
    expect(screen.getByLabelText("right panel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide right panel" }));
    expect(screen.queryByLabelText("right panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show right panel" })).toBeInTheDocument();
  });
```

Add a bottom-panel scope test:

```tsx
  it("renders bottom panel inside the center column only", () => {
    render(<ShellScreen />);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByText("Bottom Panel")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify failure modes**

Run: `bun run test src/modules/shell/ui/shellScreen.test.tsx`

Expected: FAIL — `Hide left panel` not found (old layout still present) and/or `Settings` not found

- [ ] **Step 3: Replace `ShellScreen` layout**

Replace `src/modules/shell/ui/shellScreen.tsx` with:

```tsx
import { useShellStore } from "../state/shellStore";
import { ShellCenterColumn } from "./shellCenterColumn";
import { ShellLeftPanel } from "./panels/shellLeftPanel";
import { ShellPanelSlot } from "./shellPanelSlot";
import { ShellRightPanel } from "./panels/shellRightPanel";

export function ShellScreen() {
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);
  const leftPanelWidth = useShellStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useShellStore((s) => s.rightPanelWidth);

  return (
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <ShellPanelSlot visible={leftVisible} width={leftPanelWidth}>
        <ShellLeftPanel />
      </ShellPanelSlot>
      <ShellCenterColumn />
      <ShellPanelSlot visible={rightVisible} width={rightPanelWidth}>
        <ShellRightPanel />
      </ShellPanelSlot>
    </div>
  );
}
```

- [ ] **Step 4: Delete mode bar**

```bash
rm src/modules/shell/ui/shellModeBar.tsx
```

- [ ] **Step 5: Run shell screen tests**

Run: `bun run test src/modules/shell/ui/shellScreen.test.tsx`

Expected: PASS (5 tests). Resize tests unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/modules/shell/ui/shellScreen.tsx src/modules/shell/ui/shellScreen.test.tsx
git rm src/modules/shell/ui/shellModeBar.tsx
git commit -m "Rewire shell to center-column layout with animated side slots."
```

---

### Task 9: Add shadcn sheet, switch, and label primitives

**Files:**
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/switch.tsx`
- Create: `src/components/ui/label.tsx`

- [ ] **Step 1: Install UI primitives**

Run from repo root:

```bash
bunx shadcn@latest add sheet switch label --yes
```

Expected: creates `src/components/ui/sheet.tsx`, `switch.tsx`, `label.tsx`

- [ ] **Step 2: Verify TypeScript build**

Run: `bun run build`

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/sheet.tsx src/components/ui/switch.tsx src/components/ui/label.tsx package.json bun.lock
git commit -m "Add sheet, switch, and label UI primitives."
```

---

### Task 10: Settings sheet

**Files:**
- Create: `src/modules/shell/ui/shellSettingsSheet.tsx`
- Create: `src/modules/shell/ui/shellSettingsSheet.test.tsx`
- Modify: `src/modules/shell/ui/panels/shellBottomPanel.tsx`

- [ ] **Step 1: Write failing settings tests**

Create `src/modules/shell/ui/shellSettingsSheet.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { DEFAULT_SHELL_PANEL_WIDTH } from "../state/shellPanelSizing";
import { useShellStore } from "../state/shellStore";
import { ShellBottomPanel } from "./panels/shellBottomPanel";

describe("ShellSettingsSheet", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useMemoryPersistStorage();
    useShellStore.setState({
      leftVisible: true,
      rightVisible: false,
      leftPanelWidth: 320,
      rightPanelWidth: 320,
    });
    useThemeStore.setState({ mode: "dark" });
  });

  it("opens settings sheet from bottom panel", async () => {
    const user = userEvent.setup();
    render(<ShellBottomPanel />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("switches theme from the sheet", async () => {
    const user = userEvent.setup();
    render(<ShellBottomPanel />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(useThemeStore.getState().mode).toBe("light");
  });

  it("updates panel visibility and resets widths", async () => {
    const user = userEvent.setup();
    render(<ShellBottomPanel />);
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("switch", { name: "Show right panel" }));
    expect(useShellStore.getState().rightVisible).toBe(true);
    await user.click(screen.getByRole("button", { name: "Reset panel widths" }));
    expect(useShellStore.getState().leftPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
    expect(useShellStore.getState().rightPanelWidth).toBe(DEFAULT_SHELL_PANEL_WIDTH);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/shell/ui/shellSettingsSheet.test.tsx`

Expected: FAIL — `Settings` button not found

- [ ] **Step 3: Implement `ShellSettingsSheet`**

Create `src/modules/shell/ui/shellSettingsSheet.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { ThemeMode } from "../../onboarding/domain/onboardingTheme";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { useShellStore } from "../state/shellStore";

type ShellSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShellSettingsSheet({ open, onOpenChange }: ShellSettingsSheetProps) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);
  const setLeftVisible = useShellStore((s) => s.setLeftVisible);
  const setRightVisible = useShellStore((s) => s.setRightVisible);
  const resetPanelWidths = useShellStore((s) => s.resetPanelWidths);

  const setTheme = (next: ThemeMode) => setMode(next);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(100vw,24rem)]">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Appearance and shell layout preferences.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-4">
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Appearance
            </h2>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <Button
                  key={theme}
                  type="button"
                  size="sm"
                  variant={mode === theme ? "default" : "outline"}
                  className="font-mono text-[11px] uppercase tracking-[0.08em]"
                  onClick={() => setTheme(theme)}
                >
                  {theme}
                </Button>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Panels
            </h2>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="settings-left-panel">Show left panel</Label>
              <Switch
                id="settings-left-panel"
                checked={leftVisible}
                onCheckedChange={setLeftVisible}
                aria-label="Show left panel"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="settings-right-panel">Show right panel</Label>
              <Switch
                id="settings-right-panel"
                checked={rightVisible}
                onCheckedChange={setRightVisible}
                aria-label="Show right panel"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start font-mono text-[11px] uppercase tracking-[0.08em]"
              onClick={resetPanelWidths}
            >
              Reset panel widths
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Update bottom panel**

Replace `src/modules/shell/ui/panels/shellBottomPanel.tsx` with:

```tsx
import { Settings } from "lucide-react";
import { useState } from "react";
import { PanelToolButton } from "../../../project";
import { ShellSettingsSheet } from "../shellSettingsSheet";

export function ShellBottomPanel() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <footer className="flex h-9 shrink-0 items-center border-t border-border bg-background px-2">
        <PanelToolButton label="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings className="size-3.5" />
        </PanelToolButton>
      </footer>
      <ShellSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
```

- [ ] **Step 5: Run settings tests**

Run: `bun run test src/modules/shell/ui/shellSettingsSheet.test.tsx`

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/shell/ui/shellSettingsSheet.tsx \
  src/modules/shell/ui/shellSettingsSheet.test.tsx \
  src/modules/shell/ui/panels/shellBottomPanel.tsx
git commit -m "Add settings sheet with theme and panel preferences."
```

---

### Task 11: Update shell domain docs

**Files:**
- Modify: `src/modules/shell/CONTEXT.md`

- [ ] **Step 1: Replace Mode Bar terminology**

Update `src/modules/shell/CONTEXT.md`:

- Line 3: change intro to mention center column tabs instead of mode bar
- Replace **Bottom Panel** description: "The bordered strip at the bottom of the **center column** — settings entry and reserved status area."
- Replace **Mode Bar** section with **Main Card Tabs**: "The tab row at the top of the center column with main-card switches (chat / terminal / editor). Closed side-panel toggles appear at the leading/trailing edges of this row."
- Update **Shell** definition to reference center column + side panels (not mode bar)

- [ ] **Step 2: Commit**

```bash
git add src/modules/shell/CONTEXT.md
git commit -m "Update shell context for center-column layout."
```

---

### Task 12: Full verification

**Files:** (none — verification only)

- [ ] **Step 1: Run full test suite**

Run: `bun run test`

Expected: all tests PASS

- [ ] **Step 2: Run production build**

Run: `bun run build`

Expected: exit 0

- [ ] **Step 3: Manual smoke checklist**

- [ ] Left toggle in panel header when open; `Show left panel` in tab bar when closed
- [ ] Right toggle symmetric
- [ ] Main cards switch without unmounting inactive cards
- [ ] Bottom panel does not span under sidebars
- [ ] Settings sheet: theme, panel switches, reset widths
- [ ] Panel resize handles still work when panels visible

---

## Plan self-review

| Spec requirement | Task |
| --- | --- |
| Remove full-width mode bar | Task 8 |
| Center column tabs + main + bottom | Tasks 5–6, 8 |
| Dual-host panel toggles | Tasks 3–5, 8 |
| Panel collapse animation | Task 7–8 |
| Settings sheet (theme + panel prefs) | Tasks 9–10 |
| `setLeftVisible` / `setRightVisible` / `resetPanelWidths` | Task 1 |
| Keep resize handles | Task 8 (panels unchanged) |
| Update tests | Tasks 1, 3, 8, 10, 12 |
| CONTEXT.md update | Task 11 |

No placeholder steps remain. Type names (`setLeftVisible`, `resetPanelWidths`, `ShellPanelToggle`) are consistent across tasks.
