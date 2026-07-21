# Explorer Material Icons (Monochrome) Design

## Goal

Replace Lucide file/folder prefixes in the explorer with **Material Icon Theme** shapes (same family as the popular VS Code Material extension), rendered in a **fixed neutral grayscale** — not full color, not `currentColor` tinted.

This supersedes `docs/specs/2026-07-21-explorer-file-icons-design.md` (Lucide-only mapping).

## Decisions

| Topic | Choice |
| --- | --- |
| Icon family | Material Icon Theme via official `material-icon-theme` npm package |
| Color | Fixed grayscale (`filter: grayscale(1)`), same in light and dark |
| Scope | Files **and** folders (open/closed) |
| Approach | Manifest-based resolver + `<img>` (not Lucide components) |

## Placement & API

Shared helper under `src/lib/` (replace the Lucide `getFileIcon` module):

- Prefer renaming/replacing `src/lib/fileIcons.ts` so callers stay in one place.
- Export a resolver such as:

```ts
resolveExplorerIcon(input: {
  name: string;
  isDir: boolean;
  isOpen?: boolean; // folders only; ignored for files
}): { src: string; iconId: string }
```

- Implementation uses `generateManifest()` from `material-icon-theme` and the package’s SVG files under `material-icon-theme/icons`.
- Resolution follows Material/VS Code icon-theme rules: special basename associations, then extension, then default file/folder icons. Folders use closed vs open definitions when `isOpen` is set.
- Pass **basename** (`entry.name`), not a full path.

Consumers:

- `ExplorerTree` file and folder rows render:

```tsx
<img
  src={src}
  alt=""
  aria-hidden
  className={explorerMaterialIconClassName}
/>
```

- Remove Lucide `File` / `Folder` / `FolderOpen` from those prefixes. Keep Lucide chevrons and all other app Lucide usage.
- Preserve row layout, selection, rename flow, and chevron spacer.

## Styling

- Size: match current density (`size-3` / ~12px), `shrink-0`.
- Shared class (e.g. `explorerMaterialIconClassName`) includes `filter: grayscale(1)` and mild opacity so icons read near the previous Lucide weight without tinting to text color.
- Light/dark: no per-theme recolor; grayscale assets stay fixed.

## Dependency

- Add `material-icon-theme` (runtime). No colored brand packs beyond this theme’s SVGs.
- Wire Vite so SVG URLs from the package resolve correctly (import map / `?url` / public copy — pick the smallest reliable approach in the plan).

## Edge cases

- Unknown extension/name → Material default file or folder icon (still grayscale).
- Multi-dot names → Material’s last-extension / association rules.
- `.env` / `.env.*` and other special basenames → Material associations when present.
- Directories never use file associations; files never use folder open/closed icons.

## Testing

- Unit tests for `resolveExplorerIcon`: representative files (e.g. `main.dart`, `a.ts`, `package.json`), folder open vs closed, unknown fallback; assert stable `iconId` (or equivalent) rather than brittle full URL strings when possible.
- Explorer test: known file row exposes an `<img>` with the monochrome class (not a Lucide SVG).
- Prefer `bun run test` / targeted Vitest paths.

## Out of scope

- Full-color Material icons
- User-selectable icon themes or Material icon packs (Angular, etc.)
- Icons outside the explorer in this change
- Changing chevron behavior, spacing, or selection UX beyond the prefix swap

## Migration from Lucide helper

- Delete Lucide-specific maps and `LucideIcon` return type.
- Rewrite `src/lib/fileIcons.test.ts` for the Material resolver.
- Update `ExplorerTree.tsx` / `ExplorerTree.test.tsx` accordingly.
- Keep the superseded Lucide design doc for history; new work follows this spec.
