# Explorer File Extension Icons Design

## Goal

Replace the generic Lucide `File` prefix on explorer file rows with extension- and special-filename-aware Lucide icons, so the right-panel explorer reads more like a common IDE file tree.

## Placement & API

Add a shared helper outside the explorer module:

- Path: `src/lib/fileIcons.ts`
- Export: `getFileIcon(fileName: string): LucideIcon`

Resolution order:

1. Special basename match (case-insensitive), including dotted env-style names such as `.env.local`
2. Last path extension (lowercase), e.g. `foo.test.ts` → `.ts`
3. Fallback: Lucide `File`

Consumers:

- Explorer file rows in `ExplorerTree` (normal and rename states) call `getFileIcon(entry.name)` and render that icon with the existing `explorerIconClassName`
- Folders keep `Folder` / `FolderOpen` and never call this helper
- No other call sites in the initial change; the helper lives under `src/lib/` for later reuse

## Icon mapping

Monochrome Lucide only. No colored or brand icon packs.

### By extension

| Extensions | Icon |
| --- | --- |
| `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` `.rs` `.py` `.go` `.java` `.c` `.cpp` `.h` `.cs` `.php` `.rb` `.swift` `.kt` `.html` `.htm` `.xml` | `FileCode` |
| `.json` `.jsonc` | `FileJson` |
| `.md` `.mdx` `.txt` `.rst` | `FileText` |
| `.css` `.scss` `.sass` `.less` | `Palette` |
| `.svg` `.png` `.jpg` `.jpeg` `.gif` `.webp` `.ico` `.bmp` | `Image` |
| `.yml` `.yaml` `.toml` `.ini` `.cfg` `.conf` | `Settings` |
| `.sh` `.bash` `.zsh` `.fish` `.ps1` `.bat` `.cmd` | `Terminal` |
| `.sql` | `Database` |
| `.zip` `.tar` `.gz` `.7z` `.rar` | `FileArchive` |
| `.lock` | `Lock` |
| (unknown) | `File` |

### By special basename (checked first)

| Basename / pattern | Icon |
| --- | --- |
| `Dockerfile` `Containerfile` `docker-compose.yml` `docker-compose.yaml` | `Container` |
| `Makefile` `GNUmakefile` | `Hammer` |
| `.gitignore` `.gitattributes` `.gitmodules` | `GitBranch` |
| `LICENSE` `LICENCE` `COPYING` | `Scale` |
| `package.json` `package-lock.json` `pnpm-lock.yaml` `yarn.lock` `bun.lock` `bun.lockb` | `Package` |
| `Cargo.toml` `Cargo.lock` | `Box` |
| `tsconfig.json` `jsconfig.json` `.editorconfig` | `Settings2` |
| `.env` and `.env.*` (e.g. `.env.local`, `.env.example`) | `KeyRound` |
| `README` `README.md` | `BookOpen` |

## Wiring

In `ExplorerTree`, replace hard-coded `<File />` on file rows with:

```tsx
const Icon = getFileIcon(entry.name);
<Icon className={explorerIconClassName} aria-hidden />
```

Preserve current row layout, chevron spacer, selection styles, and rename flow. This is a visual prefix change only.

## Edge cases

- No extension: special-name check, else `File`
- Multi-dot names: last segment only
- `.env.local` / `.env.example`: special basename prefix `.env`
- Directories: never use `getFileIcon`
- Matching is case-insensitive for basenames and extensions

## Testing

- Unit tests for `getFileIcon`: special name, extension, fallback, case-insensitivity, multi-dot names, `.env.*`
- Optional light explorer assertion that a known file type uses a non-generic icon; helper tests carry most of the weight

## Out of scope

- Colored / Material / VS Code icon themes
- Folder icon changes
- Icons outside the explorer in the initial change
- New npm dependencies (use existing `lucide-react`)
