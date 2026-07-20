# Adaptive Window Layout Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shell columns and module UIs compress in place when the window shrinks (manual resize or GUI scale), with proportional left/center/right squeeze below the shell reference width, without changing GUI scale snap behavior.

**Architecture:** A pure `distributeShellColumnWidths` helper maps preferred panel widths + available content width → displayed widths (full preferred at/above 1280px reference; proportional scale below). `ShellScreen` measures its root with `ResizeObserver` and feeds displayed widths into panel slots and gutters. Onboarding, workspace popup, and settings use fluid CSS (`clamp`, `min-w-0`, `max-h` + scroll) so short/narrow windows do not chop chrome.

**Tech Stack:** React 19, Zustand (existing shell store), Vitest + Testing Library, Tailwind CSS utilities, existing GUI scale / session window controller (unchanged).

**Spec:** `docs/specs/2026-07-20-adaptive-window-layout-design.md`  
**Worktree:** `/Users/beng/Documents/Tauri Projects/opencore-taurians/.worktrees/feat-gui-scale` on branch `feat/gui-scale`

## Global Constraints

- Compress in place — never auto-hide panels when the window narrows.
- Proportional shrink of left / center / right when `available < SHELL_LAYOUT_REFERENCE_WIDTH` (1280, matching `SHELL_WINDOW_SIZE.width`).
- Store `leftPanelWidth` / `rightPanelWidth` remain **preferred**; slots/gutters use **displayed** widths from the distributor.
- Drag clamp on preferred stays `MIN_SHELL_PANEL_WIDTH` (160) / `MAX_SHELL_PANEL_WIDTH` (480).
- Floors under squeeze: panels 160, center `MIN_SHELL_CENTER_WIDTH` (320). If floors exceed available, keep floors; content scrolls inside panels.
- Above reference width: panels stay at preferred; center absorbs extra space.
- GUI scale snap (`base × scale`) stays unchanged — do not persist free-form window size across scale changes.
- No width-redistribution animation on window resize (instant geometry). Panel open/close motion unchanged.
- Plans/specs live under `docs/plans` and `docs/specs`.
- Prefer `bun run test` / targeted Vitest file paths (repo uses Vitest via `bun`).

## File structure

| File | Responsibility |
| --- | --- |
| `src/modules/shell/state/shellColumnLayout.ts` | Pure distributor + `MIN_SHELL_CENTER_WIDTH` + `SHELL_LAYOUT_REFERENCE_WIDTH` |
| `src/modules/shell/state/shellColumnLayout.test.ts` | Unit tests for distributor |
| `src/modules/shell/ui/shellScreen.tsx` | Measure available width; apply displayed widths to slots/gutters |
| `src/modules/shell/ui/shellScreen.test.tsx` | Narrow-container proportional + preferred-preserved tests |
| `src/modules/onboarding/ui/onboardingScreen.tsx` | Fluid orb height, tighter gaps, earlier single-column |
| `src/modules/onboarding/ui/onboardingScreen.test.tsx` | No-overflow layout assertion in a short/narrow wrapper |
| `src/modules/workspace-popup/ui/workspacePopup.tsx` | Margins, `max-h` + internal scroll, tighter padding |
| `src/modules/workspace-popup/ui/workspacePopup.test.tsx` | Narrow viewport keeps dialog on-screen |
| `src/modules/shell/ui/shellSettingsPage.tsx` | `min-w-0` / wrapping polish on settings rows |
| `src/modules/shell/CONTEXT.md` | Document preferred vs displayed widths briefly |

---

### Task 1: Pure column width distributor

**Files:**
- Create: `src/modules/shell/state/shellColumnLayout.ts`
- Create: `src/modules/shell/state/shellColumnLayout.test.ts`

**Interfaces:**
- Consumes: `MIN_SHELL_PANEL_WIDTH` from `./shellPanelSizing`
- Produces:
  - `SHELL_LAYOUT_REFERENCE_WIDTH = 1280`
  - `MIN_SHELL_CENTER_WIDTH = 320`
  - `distributeShellColumnWidths(input: { available: number; leftPreferred: number; rightPreferred: number; leftVisible: boolean; rightVisible: boolean }): { left: number; center: number; right: number }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL_PANEL_WIDTH, MIN_SHELL_PANEL_WIDTH } from "./shellPanelSizing";
import {
  MIN_SHELL_CENTER_WIDTH,
  SHELL_LAYOUT_REFERENCE_WIDTH,
  distributeShellColumnWidths,
} from "./shellColumnLayout";

describe("distributeShellColumnWidths", () => {
  const base = {
    leftPreferred: DEFAULT_SHELL_PANEL_WIDTH,
    rightPreferred: DEFAULT_SHELL_PANEL_WIDTH,
    leftVisible: true,
    rightVisible: true,
  };

  it("keeps preferred panels above reference and gives center the rest", () => {
    const available = SHELL_LAYOUT_REFERENCE_WIDTH + 200;
    expect(distributeShellColumnWidths({ ...base, available })).toEqual({
      left: DEFAULT_SHELL_PANEL_WIDTH,
      center: available - DEFAULT_SHELL_PANEL_WIDTH * 2,
      right: DEFAULT_SHELL_PANEL_WIDTH,
    });
  });

  it("keeps preferred panels at reference width", () => {
    const available = SHELL_LAYOUT_REFERENCE_WIDTH;
    expect(distributeShellColumnWidths({ ...base, available })).toEqual({
      left: DEFAULT_SHELL_PANEL_WIDTH,
      center: available - DEFAULT_SHELL_PANEL_WIDTH * 2,
      right: DEFAULT_SHELL_PANEL_WIDTH,
    });
  });

  it("scales left and right proportionally below reference", () => {
    const available = 1000;
    const scale = available / SHELL_LAYOUT_REFERENCE_WIDTH;
    const left = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
    const right = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
    expect(distributeShellColumnWidths({ ...base, available })).toEqual({
      left,
      center: available - left - right,
      right,
    });
  });

  it("ignores hidden panels in the sum", () => {
    const available = 1000;
    const scale = available / SHELL_LAYOUT_REFERENCE_WIDTH;
    const left = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
    expect(
      distributeShellColumnWidths({
        ...base,
        available,
        rightVisible: false,
      }),
    ).toEqual({
      left,
      center: available - left,
      right: 0,
    });
  });

  it("returns only center when both panels are hidden", () => {
    expect(
      distributeShellColumnWidths({
        ...base,
        available: 800,
        leftVisible: false,
        rightVisible: false,
      }),
    ).toEqual({ left: 0, center: 800, right: 0 });
  });

  it("clamps to floors when available is extremely small", () => {
    const result = distributeShellColumnWidths({
      ...base,
      available: 200,
    });
    expect(result.left).toBeGreaterThanOrEqual(MIN_SHELL_PANEL_WIDTH);
    expect(result.right).toBeGreaterThanOrEqual(MIN_SHELL_PANEL_WIDTH);
    expect(result.center).toBeGreaterThanOrEqual(MIN_SHELL_CENTER_WIDTH);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/shell/state/shellColumnLayout.test.ts`  
Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Write minimal implementation**

```ts
import { MIN_SHELL_PANEL_WIDTH } from "./shellPanelSizing";

export const SHELL_LAYOUT_REFERENCE_WIDTH = 1280;
export const MIN_SHELL_CENTER_WIDTH = 320;

export type ShellColumnWidths = {
  left: number;
  center: number;
  right: number;
};

export type DistributeShellColumnWidthsInput = {
  available: number;
  leftPreferred: number;
  rightPreferred: number;
  leftVisible: boolean;
  rightVisible: boolean;
};

export function distributeShellColumnWidths(
  input: DistributeShellColumnWidthsInput,
): ShellColumnWidths {
  const available = Number.isFinite(input.available)
    ? Math.max(0, Math.round(input.available))
    : 0;
  const leftTarget = input.leftVisible ? input.leftPreferred : 0;
  const rightTarget = input.rightVisible ? input.rightPreferred : 0;

  let left: number;
  let right: number;
  let center: number;

  if (available >= SHELL_LAYOUT_REFERENCE_WIDTH) {
    left = leftTarget;
    right = rightTarget;
    center = available - left - right;
  } else {
    const scale =
      SHELL_LAYOUT_REFERENCE_WIDTH > 0
        ? available / SHELL_LAYOUT_REFERENCE_WIDTH
        : 0;
    left = input.leftVisible ? Math.round(leftTarget * scale) : 0;
    right = input.rightVisible ? Math.round(rightTarget * scale) : 0;
    center = available - left - right;
  }

  if (input.leftVisible) left = Math.max(MIN_SHELL_PANEL_WIDTH, left);
  if (input.rightVisible) right = Math.max(MIN_SHELL_PANEL_WIDTH, right);
  center = Math.max(MIN_SHELL_CENTER_WIDTH, center);

  // If floors fit, re-balance center so the sum matches available.
  const panels = left + right;
  if (panels + MIN_SHELL_CENTER_WIDTH <= available) {
    center = available - panels;
  }

  return { left, center, right };
}
```

Note: When floors exceed `available`, the sum may be `> available` (spec: keep floors; content scrolls). Do not force-shrink below floors.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/shell/state/shellColumnLayout.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/state/shellColumnLayout.ts src/modules/shell/state/shellColumnLayout.test.ts
git commit -m "$(cat <<'EOF'
Add pure shell column width distributor for adaptive layout.

EOF
)"
```

---

### Task 2: Wire ShellScreen to displayed widths

**Files:**
- Modify: `src/modules/shell/ui/shellScreen.tsx`
- Modify: `src/modules/shell/ui/shellScreen.test.tsx`

**Interfaces:**
- Consumes: `distributeShellColumnWidths` from `../state/shellColumnLayout`
- Produces: Shell root measures `clientWidth` via `ResizeObserver`; left/right `ShellPanelSlot` and resize gutters use **displayed** widths; store still holds preferred widths; drag handlers unchanged (`setLeftPanelWidth` / `setRightPanelWidth`)

- [ ] **Step 1: Write the failing tests**

Add to `shellScreen.test.tsx`:

```ts
import { SHELL_LAYOUT_REFERENCE_WIDTH } from "../state/shellColumnLayout";

function mockShellWidth(width: number) {
  class RO {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      Object.defineProperty(target, "clientWidth", {
        configurable: true,
        value: width,
      });
      this.cb(
        [{ target, contentRect: { width } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", RO);
}

it("uses preferred panel widths at the layout reference width", () => {
  mockShellWidth(SHELL_LAYOUT_REFERENCE_WIDTH);
  const { container } = render(<ShellScreen />);
  const leftSlot = container.querySelector(
    '[data-shell-panel-side="left"]',
  ) as HTMLElement;
  expect(leftSlot.style.width).toBe(`${DEFAULT_SHELL_PANEL_WIDTH}px`);
});

it("scales displayed panel widths below the reference width", () => {
  mockShellWidth(1000);
  const { container } = render(<ShellScreen />);
  const scale = 1000 / SHELL_LAYOUT_REFERENCE_WIDTH;
  const expected = Math.round(DEFAULT_SHELL_PANEL_WIDTH * scale);
  const leftSlot = container.querySelector(
    '[data-shell-panel-side="left"]',
  ) as HTMLElement;
  expect(leftSlot.style.width).toBe(`${expected}px`);
});

it("keeps preferred store width when dragging under a narrow shell", () => {
  mockShellWidth(1000);
  render(<ShellScreen />);
  const handle = screen.getByRole("separator", { name: /resize left panel/i });
  fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1, button: 0 });
  fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(useShellStore.getState().leftPanelWidth).toBe(258);
});
```

Add `vi` to the vitest import. Call `vi.unstubAllGlobals()` in `afterEach` (or restore `ResizeObserver`) so other tests are unaffected. Existing resize tests should still pass — they assert store preferred width, not displayed width. For those tests, either leave default `ResizeObserver` unset (fall back to reference width in implementation when unmeasured) or mock `SHELL_LAYOUT_REFERENCE_WIDTH` so displayed === preferred.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/shell/ui/shellScreen.test.tsx`  
Expected: FAIL on new assertions (slots still use preferred always / no ResizeObserver wiring)

- [ ] **Step 3: Write minimal implementation**

In `shellScreen.tsx`:

1. Import `useRef`, keep `useEffect` / `useState`.
2. Import `distributeShellColumnWidths`, `SHELL_LAYOUT_REFERENCE_WIDTH` from `../state/shellColumnLayout`.
3. Add root ref + `availableWidth` state, defaulting to `SHELL_LAYOUT_REFERENCE_WIDTH` so SSR/tests without RO still get preferred === displayed.
4. `useEffect` that observes `rootRef.current` with `ResizeObserver`, sets `availableWidth` from `entry.contentRect.width` or `clientWidth` (rounded).
5. Compute:

```ts
const columns = distributeShellColumnWidths({
  available: availableWidth,
  leftPreferred: leftPanelWidth,
  rightPreferred: rightPanelWidth,
  leftVisible,
  rightVisible,
});
```

6. Pass `columns.left` / `columns.right` into every `ShellPanelSlot` `width` prop and into gutter `style.left` / `style.right` math (replace `leftPanelWidth` / `rightPanelWidth` in layout positions only).
7. Keep `getWidth={() => useShellStore.getState().leftPanelWidth}` (preferred) and `onResize={setLeftPanelWidth}` unchanged.
8. Put `ref={rootRef}` on the outermost shell `div` (`relative flex h-full ...`). Optional: `data-shell-available-width={String(availableWidth)}` for debugging/tests.

Do **not** animate `availableWidth`-driven width changes beyond what `ShellPanelSlot` already does for visibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/shell/ui/shellScreen.test.tsx`  
Expected: PASS (including existing panel resize tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/ui/shellScreen.tsx src/modules/shell/ui/shellScreen.test.tsx
git commit -m "$(cat <<'EOF'
Apply proportional displayed panel widths in the shell layout.

EOF
)"
```

---

### Task 3: Onboarding fluid layout

**Files:**
- Modify: `src/modules/onboarding/ui/onboardingScreen.tsx`
- Modify: `src/modules/onboarding/ui/onboardingScreen.test.tsx`

**Interfaces:**
- Consumes: existing onboarding markup / theme
- Produces: fluid orb height, compressible gaps/padding, single-column earlier on narrow widths; brand + CTA remain visible

- [ ] **Step 1: Write the failing test**

```ts
it("keeps onboarding content within a short narrow container", () => {
  const { container } = render(
    <div style={{ width: 480, height: 420, overflow: "hidden" }}>
      <ThemeProvider>
        <OnboardingScreen onEnter={vi.fn()} />
      </ThemeProvider>
    </div>,
  );
  const screenRoot = container.querySelector(".onboarding-screen") as HTMLElement;
  // Layout CSS should not force a taller intrinsic min than the wrapper.
  // Assert the orb no longer uses fixed 260/300px classes.
  const orb = screenRoot.querySelector(".onboarding-enter-2") as HTMLElement;
  expect(orb.className).not.toMatch(/h-\[260px\]/);
  expect(orb.className).not.toMatch(/md:h-\[300px\]/);
  expect(orb.className).toMatch(/clamp|min-h-0|h-/);
});
```

(Adjust the final class assertion to match the exact utilities chosen in Step 3 — prefer asserting absence of fixed heights plus presence of a `clamp`-based class string.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/onboarding/ui/onboardingScreen.test.tsx`  
Expected: FAIL (still has `h-[260px]` / `md:h-[300px]`)

- [ ] **Step 3: Write minimal implementation**

In `onboardingScreen.tsx`, update classes approximately as:

- Outer content grid: keep `h-full min-h-full`; reduce padding toward `px-6 py-5 sm:px-8 sm:py-7 md:px-12 md:py-9`.
- Main section: use `grid ... gap-6 py-6 md:grid-cols-[...] md:gap-14 md:py-12` (single column by default; two columns from `md`).
- Orb wrapper: replace `h-[260px] ... md:h-[300px]` with  
  `h-[clamp(140px,32vh,300px)] w-full max-w-[480px] min-h-0 justify-self-start`.
- Copy column: keep `max-w-lg`; allow `gap-4 md:gap-5`.
- Footer: keep brand/CTA row; allow `gap-4` and wrapping if needed (`flex-wrap`).

Do not change enter animation class names (`onboarding-enter-*`) relied on by CSS.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/onboarding/ui/onboardingScreen.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/onboarding/ui/onboardingScreen.tsx src/modules/onboarding/ui/onboardingScreen.test.tsx
git commit -m "$(cat <<'EOF'
Make onboarding layout fluid for short and narrow windows.

EOF
)"
```

---

### Task 4: Workspace popup fluid layout

**Files:**
- Modify: `src/modules/workspace-popup/ui/workspacePopup.tsx`
- Modify: `src/modules/workspace-popup/ui/workspacePopup.test.tsx`

**Interfaces:**
- Consumes: existing dialog markup
- Produces: dialog stays on-screen in narrow/short viewports via horizontal margin, `max-h`, and internal scroll

- [ ] **Step 1: Write the failing test**

Read existing test helpers in `workspacePopup.test.tsx`, then add:

```ts
it("keeps the dialog within a narrow short viewport", () => {
  const { container } = render(
    <div style={{ width: 360, height: 400 }}>
      <WorkspacePopup onClose={vi.fn()} />
    </div>,
  );
  const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
  expect(dialog.className).toMatch(/max-h-/);
  expect(dialog.className).toMatch(/overflow-y-auto|overflow-auto/);
  expect(dialog.className).toMatch(/mx-/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/modules/workspace-popup/ui/workspacePopup.test.tsx`  
Expected: FAIL (missing max-h / overflow / mx utilities)

- [ ] **Step 3: Write minimal implementation**

Update the dialog `className` in `workspacePopup.tsx`:

- Keep `relative w-full max-w-[420px]`.
- Add horizontal margin: `mx-4`.
- Add `max-h-[min(100%,calc(100dvh-2rem))] overflow-y-auto` (or `max-h-[calc(100%-2rem)]` relative to the fixed backdrop flex centering).
- Slightly tighten padding on small heights if needed: `px-6 py-8 sm:px-8 sm:py-10`.

Backdrop stays `fixed inset-0 ... flex items-center justify-center`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/modules/workspace-popup/ui/workspacePopup.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/workspace-popup/ui/workspacePopup.tsx src/modules/workspace-popup/ui/workspacePopup.test.tsx
git commit -m "$(cat <<'EOF'
Keep workspace popup usable in narrow and short windows.

EOF
)"
```

---

### Task 5: Settings row polish + shell context docs

**Files:**
- Modify: `src/modules/shell/ui/shellSettingsPage.tsx`
- Modify: `src/modules/shell/CONTEXT.md`
- Modify: `src/modules/shell/ui/shellSettingsPage.test.tsx` only if a new assertion is needed (optional — existing tests should stay green)

**Interfaces:**
- Consumes: existing settings sections
- Produces: settings rows wrap/`min-w-0` under narrow center; CONTEXT documents preferred vs displayed widths

- [ ] **Step 1: Write / extend a focused assertion (optional but preferred)**

If `shellSettingsPage.test.tsx` already opens Appearance, add:

```ts
it("keeps appearance rows from forcing horizontal overflow classes", async () => {
  const user = userEvent.setup();
  render(<ShellScreen />);
  await user.click(screen.getByRole("button", { name: "Settings" }));
  const scaleRow = screen.getByText(/gui scale/i).closest("div");
  expect(scaleRow?.className ?? "").toMatch(/min-w-0|flex/);
});
```

If this is brittle, skip the new test and rely on manual class updates + full suite.

- [ ] **Step 2: Apply settings CSS polish**

In `shellSettingsPage.tsx`:

- Ensure the scroll container and section stacks use `min-w-0`.
- On labeled rows (`flex items-start justify-between gap-4`), ensure the text column has `min-w-0` and controls `shrink-0` where appropriate so labels wrap instead of overflowing.
- GUI scale row: percentage label must not push the slider off-screen (`tabular-nums shrink-0`, slider `min-w-0 flex-1`).

- [ ] **Step 3: Update CONTEXT.md**

Add a short language entry (or extend Settings / Left Panel):

```markdown
**Preferred Panel Width**:
The user-chosen left/right sidebar width stored in the shell store. Drag handles write this value. Below the shell layout reference width (1280px), the shell displays a proportionally smaller width so columns compress together.
_Avoid_: Displayed width (when referring to the stored preference)
```

- [ ] **Step 4: Run related tests**

Run: `bun run test src/modules/shell/ui/shellSettingsPage.test.tsx src/modules/shell/ui/shellScreen.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/shell/ui/shellSettingsPage.tsx src/modules/shell/CONTEXT.md src/modules/shell/ui/shellSettingsPage.test.tsx
git commit -m "$(cat <<'EOF'
Polish settings wrapping and document shell preferred panel widths.

EOF
)"
```

---

### Task 6: Cross-module verification + GUI scale regression

**Files:**
- Verify only (no required production changes unless a test reveals a chop): explorer/project trees already truncate + `overflow-auto`
- Touch code only if a failure shows a concrete overflow bug

**Interfaces:**
- Consumes: Tasks 1–5
- Produces: green targeted suites including existing GUI scale tests

- [ ] **Step 1: Run adaptive + GUI scale related suites**

```bash
bun run test \
  src/modules/shell/state/shellColumnLayout.test.ts \
  src/modules/shell/ui/shellScreen.test.tsx \
  src/modules/shell/ui/shellSettingsPage.test.tsx \
  src/modules/onboarding/ui/onboardingScreen.test.tsx \
  src/modules/workspace-popup/ui/workspacePopup.test.tsx \
  src/modules/session/domain/sessionGuiScale.test.ts \
  src/modules/session/ui/sessionRoot.test.tsx \
  src/modules/explorer/ui/ExplorerPanel.test.tsx
```

Expected: PASS

- [ ] **Step 2: If explorer/project fails under narrow assumptions, fix minimally**

Only if tests or obvious `min-w` bugs appear: add `min-w-0` on the offending flex child. Do not refactor trees.

- [ ] **Step 3: Commit only if Step 2 produced fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Fix narrow-panel overflow found during adaptive layout verification.

EOF
)"
```

If no fixes: no commit.

---

## Self-review checklist (author)

1. **Spec coverage:** Distributor, ShellScreen wiring, onboarding, popup, settings, CONTEXT, GUI scale unchanged, explorer verify — each has a task.
2. **No placeholders:** Concrete code, commands, paths.
3. **Types:** `distributeShellColumnWidths` signature consistent across Task 1–2.
4. **Out of scope respected:** No auto-collapse, no window-size persistence, no vertical splitter, no scale snap changes.
