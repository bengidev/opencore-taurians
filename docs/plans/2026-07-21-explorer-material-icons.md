# Explorer Material Monochrome Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Lucide explorer file/folder prefixes with Material Icon Theme SVGs rendered in fixed neutral grayscale.

**Architecture:** Depend on official `material-icon-theme`, resolve basename → icon id via `generateManifest()` (fileNames / compound fileExtensions / folderNames), map ids to Vite `?url` SVG assets, render `<img>` in `ExplorerTree` with a shared grayscale class. Supersedes the Lucide `getFileIcon` helper.

**Tech Stack:** React 19, Vite 7, Vitest, `material-icon-theme`, existing explorer module.

**Spec:** `docs/specs/2026-07-21-explorer-material-icons-design.md`

## Global Constraints

- Material Icon Theme only via official `material-icon-theme` package — no other icon packs.
- Fixed grayscale (`filter: grayscale(1)`), not full color, not `currentColor` tint.
- Files **and** folders (open/closed) use Material icons.
- Resolver API: `resolveExplorerIcon({ name, isDir, isOpen? }): { src: string; iconId: string }`.
- Pass basename (`entry.name`) only — never full paths.
- Preserve explorer layout, chevrons, selection, rename flow; Lucide remains for chevrons and non-explorer UI.
- Prefer `bun run test` / targeted Vitest paths.
- Plans/specs live under `docs/plans` and `docs/specs`.

## File structure

| File | Responsibility |
| --- | --- |
| `package.json` / `bun.lock` | Add `material-icon-theme` dependency |
| `src/lib/fileIcons.ts` | Manifest resolver + SVG URL map; replace Lucide helper |
| `src/lib/fileIcons.test.ts` | Unit tests for resolution rules |
| `src/modules/explorer/ui/explorerStyles.ts` | `explorerMaterialIconClassName` (grayscale) |
| `src/modules/explorer/ui/ExplorerTree.tsx` | Render `<img>` for files and folders |
| `src/modules/explorer/ui/ExplorerTree.test.tsx` | Assert Material `<img>` (not Lucide SVG) |

---

### Task 1: Material `resolveExplorerIcon` helper

**Files:**
- Modify: `package.json`, `bun.lock` (via `bun add`)
- Replace: `src/lib/fileIcons.ts`
- Replace: `src/lib/fileIcons.test.ts`

**Interfaces:**
- Consumes: `generateManifest` from `material-icon-theme`; SVG assets via `import.meta.glob`
- Produces: `resolveExplorerIcon({ name: string; isDir: boolean; isOpen?: boolean }): { src: string; iconId: string }`

- [ ] **Step 1: Add the dependency**

Run:

```bash
bun add material-icon-theme
```

Expected: `package.json` lists `material-icon-theme`; lockfile updates.

- [ ] **Step 2: Write the failing tests**

Replace `src/lib/fileIcons.test.ts` entirely with:

```ts
import { describe, expect, it } from "vitest";
import { resolveExplorerIcon } from "./fileIcons";

describe("resolveExplorerIcon", () => {
  it("maps file extensions and special basenames to Material icon ids", () => {
    expect(resolveExplorerIcon({ name: "main.dart", isDir: false }).iconId).toBe(
      "dart",
    );
    expect(resolveExplorerIcon({ name: "a.ts", isDir: false }).iconId).toBe(
      "typescript",
    );
    expect(resolveExplorerIcon({ name: "foo.test.ts", isDir: false }).iconId).toBe(
      "test-ts",
    );
    expect(resolveExplorerIcon({ name: "package.json", isDir: false }).iconId).toBe(
      "nodejs",
    );
    expect(resolveExplorerIcon({ name: "PACKAGE.JSON", isDir: false }).iconId).toBe(
      "nodejs",
    );
    expect(resolveExplorerIcon({ name: "README.md", isDir: false }).iconId).toBe(
      "readme",
    );
    expect(resolveExplorerIcon({ name: ".env", isDir: false }).iconId).toBe("tune");
    expect(resolveExplorerIcon({ name: ".env.local", isDir: false }).iconId).toBe(
      "tune",
    );
    expect(resolveExplorerIcon({ name: "Dockerfile", isDir: false }).iconId).toBe(
      "docker",
    );
  });

  it("falls back to Material default file icon", () => {
    expect(resolveExplorerIcon({ name: "mystery", isDir: false }).iconId).toBe(
      "file",
    );
  });

  it("maps folders including open state and named folders", () => {
    expect(
      resolveExplorerIcon({ name: "lib", isDir: true, isOpen: false }).iconId,
    ).toBe("folder");
    expect(
      resolveExplorerIcon({ name: "lib", isDir: true, isOpen: true }).iconId,
    ).toBe("folder-open");
    expect(
      resolveExplorerIcon({ name: "src", isDir: true, isOpen: false }).iconId,
    ).toBe("folder-src");
    expect(
      resolveExplorerIcon({ name: "src", isDir: true, isOpen: true }).iconId,
    ).toBe("folder-src-open");
  });

  it("returns a non-empty src string for resolved icons", () => {
    const file = resolveExplorerIcon({ name: "main.dart", isDir: false });
    expect(file.src.length).toBeGreaterThan(0);
    expect(file.src).toMatch(/dart\.svg/i);

    const folder = resolveExplorerIcon({
      name: "src",
      isDir: true,
      isOpen: true,
    });
    expect(folder.src.length).toBeGreaterThan(0);
    expect(folder.src).toMatch(/folder-src-open\.svg/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun run test src/lib/fileIcons.test.ts`

Expected: FAIL (`resolveExplorerIcon` missing, or Lucide `getFileIcon` export mismatch)

- [ ] **Step 4: Write the implementation**

Replace `src/lib/fileIcons.ts` entirely with:

```ts
import { generateManifest, type Manifest } from "material-icon-theme";

export type ResolveExplorerIconInput = {
  name: string;
  isDir: boolean;
  isOpen?: boolean;
};

export type ResolvedExplorerIcon = {
  src: string;
  iconId: string;
};

const manifest: Manifest = generateManifest();

const iconUrlModules = import.meta.glob(
  "../../node_modules/material-icon-theme/icons/*.svg",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const srcByIconId = new Map<string, string>();
for (const [modulePath, url] of Object.entries(iconUrlModules)) {
  const file = modulePath.split("/").pop();
  if (!file || !file.endsWith(".svg")) continue;
  srcByIconId.set(file.slice(0, -4), url);
}

function srcForIconId(iconId: string): string {
  return (
    srcByIconId.get(iconId) ??
    srcByIconId.get("file") ??
    srcByIconId.get("folder") ??
    ""
  );
}

function resolveFileIconId(fileName: string): string {
  const lower = fileName.toLowerCase();
  const byName = manifest.fileNames?.[lower];
  if (byName) return byName;

  // Match Material/VS Code compound extensions: foo.test.ts → test.ts → ts
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    const byExt = manifest.fileExtensions?.[ext];
    if (byExt) return byExt;
  }

  return manifest.file ?? "file";
}

function resolveFolderIconId(folderName: string, isOpen: boolean): string {
  const lower = folderName.toLowerCase();
  if (isOpen) {
    return (
      manifest.folderNamesExpanded?.[lower] ??
      manifest.folderExpanded ??
      "folder-open"
    );
  }
  return manifest.folderNames?.[lower] ?? manifest.folder ?? "folder";
}

export function resolveExplorerIcon(
  input: ResolveExplorerIconInput,
): ResolvedExplorerIcon {
  const iconId = input.isDir
    ? resolveFolderIconId(input.name, Boolean(input.isOpen))
    : resolveFileIconId(input.name);

  return { iconId, src: srcForIconId(iconId) };
}
```

Notes for implementers:

- If `import.meta.glob` finds zero modules (wrong relative path), fix the glob so it points at `material-icon-theme/icons/*.svg` from `src/lib/` (keep relative `./` / `../` form — Vite requires it).
- Do not re-export Lucide `getFileIcon`.
- Icon id expectations in tests match Material manifest defaults as of `material-icon-theme@5.37.x`. If a newer package bumps an association, update the test expectation to the package’s current id and note it in the commit message.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test src/lib/fileIcons.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/lib/fileIcons.ts src/lib/fileIcons.test.ts
git commit -m "$(cat <<'EOF'
Replace Lucide file icons with Material theme resolver.

EOF
)"
```

---

### Task 2: Wire grayscale Material icons into ExplorerTree

**Files:**
- Modify: `src/modules/explorer/ui/explorerStyles.ts`
- Modify: `src/modules/explorer/ui/ExplorerTree.tsx`
- Modify: `src/modules/explorer/ui/ExplorerTree.test.tsx`

**Interfaces:**
- Consumes: `resolveExplorerIcon` from `@/lib/fileIcons`
- Produces: file and folder rows render `<img src={…} className={explorerMaterialIconClassName} />`

- [ ] **Step 1: Add the monochrome class**

In `src/modules/explorer/ui/explorerStyles.ts`, replace:

```ts
export const explorerIconClassName = "size-3 shrink-0 opacity-80";
```

with:

```ts
/** Lucide prefixes (chevrons, etc.) */
export const explorerIconClassName = "size-3 shrink-0 opacity-80";

/** Material file/folder <img> prefixes — fixed grayscale, not currentColor */
export const explorerMaterialIconClassName =
  "size-3 shrink-0 opacity-80 [filter:grayscale(1)]";
```

Keep `explorerIconClassName` for any remaining Lucide usages if needed; explorer file/folder prefixes must use `explorerMaterialIconClassName`.

- [ ] **Step 2: Write the failing explorer assertion**

In `src/modules/explorer/ui/ExplorerTree.test.tsx`:

1. Remove `import { FileCode } from "lucide-react";`
2. Replace the test named `uses a type-specific Lucide icon for known file extensions` with:

```ts
  it("renders grayscale Material icons for files and folders", async () => {
    const folderPath = "/proj";
    useProjectStore.getState().createProjectWithRootTrunk({
      folderPath,
      nowIso: "2026-07-10T00:00:00.000Z",
    });

    const api = createMemoryExplorerApi({
      projectRoot: folderPath,
      dirs: {
        [folderPath]: [
          { name: "main.dart", path: "/proj/main.dart", isDir: false },
          { name: "src", path: "/proj/src", isDir: true },
        ],
        ["/proj/src"]: [],
      },
    });
    useExplorerStore.getState().bindApi(api);
    await useExplorerStore.getState().loadRoot();

    const { container } = render(<ExplorerTree />);
    expect(await screen.findByText("main.dart")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();

    const fileRow = screen.getByText("main.dart").closest("button");
    const fileImg = fileRow?.querySelector("img");
    expect(fileImg).not.toBeNull();
    expect(fileImg?.getAttribute("src") ?? "").toMatch(/dart\.svg/i);
    expect(fileImg?.className ?? "").toMatch(/grayscale/);

    const folderRow = screen.getByText("src").closest("button");
    const folderImg = folderRow?.querySelector("img");
    expect(folderImg).not.toBeNull();
    expect(folderImg?.getAttribute("src") ?? "").toMatch(/folder-src\.svg/i);
    expect(folderImg?.className ?? "").toMatch(/grayscale/);

    expect(container.querySelector("svg.lucide-file")).toBeNull();
    expect(container.querySelector("svg.lucide-folder")).toBeNull();
  });
```

- [ ] **Step 3: Run the explorer test to verify it fails**

Run: `bun run test src/modules/explorer/ui/ExplorerTree.test.tsx`

Expected: FAIL on Material `<img>` / grayscale assertions (still Lucide SVGs)

- [ ] **Step 4: Wire ExplorerTree**

In `src/modules/explorer/ui/ExplorerTree.tsx`:

1. Change lucide import to chevron only:

```ts
import { ChevronRight } from "lucide-react";
```

2. Replace `getFileIcon` import with:

```ts
import { resolveExplorerIcon } from "@/lib/fileIcons";
```

3. Update style imports to include `explorerMaterialIconClassName` (keep chevron helpers; drop `explorerIconClassName` if unused).

4. Add a tiny local helper above `ExplorerEntryRow` (or inline equivalently):

```tsx
function ExplorerEntryIcon({
  name,
  isDir,
  isOpen,
}: {
  name: string;
  isDir: boolean;
  isOpen?: boolean;
}) {
  const { src } = resolveExplorerIcon({ name, isDir, isOpen });
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={explorerMaterialIconClassName}
    />
  );
}
```

5. In the **folder** branch:
   - Rename state: replace `<Folder className={explorerIconClassName} aria-hidden />` with `<ExplorerEntryIcon name={entry.name} isDir isOpen={false} />` (or `isOpen={expanded}` if you prefer consistency while renaming — default closed is fine).
   - Normal button: replace the `Folder` / `FolderOpen` ternary with:

```tsx
              <ExplorerEntryIcon
                name={entry.name}
                isDir
                isOpen={expanded}
              />
```

   Keep `ChevronRight` as-is.

6. In the **file** branch: remove `const FileIcon = getFileIcon(entry.name);`. Replace both `<FileIcon … />` usages with:

```tsx
            <ExplorerEntryIcon name={entry.name} isDir={false} />
```

Do not change padding, spacers, click handlers, or selection classes.

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
bun run test src/lib/fileIcons.test.ts src/modules/explorer/ui/ExplorerTree.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/explorer/ui/explorerStyles.ts src/modules/explorer/ui/ExplorerTree.tsx src/modules/explorer/ui/ExplorerTree.test.tsx
git commit -m "$(cat <<'EOF'
Show grayscale Material icons on explorer file and folder rows.

EOF
)"
```

---

## Self-review checklist (author)

- Spec coverage: Material dependency, resolver API, grayscale styling, files + folders, Lucide removal on prefixes, unit + explorer tests — Tasks 1–2.
- No placeholders left in steps.
- `resolveExplorerIcon` signature consistent across tasks.
- Out of scope left out: full color, theme picker, icon packs, non-explorer call sites.
