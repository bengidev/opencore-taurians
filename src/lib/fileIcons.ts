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
  { eager: true, query: "?url&no-inline", import: "default" },
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
