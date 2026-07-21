import type { ExplorerEntry } from "./explorerTypes";

export type FilterExplorerTreeResult = {
  childrenByPath: Record<string, ExplorerEntry[]>;
  displayOpenPaths: Set<string>;
};

export function filterExplorerTree(input: {
  childrenByPath: Record<string, ExplorerEntry[]>;
  rootPath: string;
  query: string;
}): FilterExplorerTreeResult | null {
  const trimmed = input.query.trim();
  if (!trimmed) {
    return null;
  }

  const needle = trimmed.toLowerCase();
  const source = input.childrenByPath;
  const filtered: Record<string, ExplorerEntry[]> = {};
  const displayOpenPaths = new Set<string>();

  const matches = (name: string): boolean =>
    name.toLowerCase().includes(needle);

  const filterDir = (dirPath: string): ExplorerEntry[] => {
    const children = source[dirPath] ?? [];
    const kept: ExplorerEntry[] = [];

    for (const entry of children) {
      if (entry.isDir) {
        const childKept = filterDir(entry.path);
        if (matches(entry.name) || childKept.length > 0) {
          kept.push(entry);
          filtered[entry.path] = childKept;
          if (childKept.length > 0) {
            displayOpenPaths.add(entry.path);
          }
        }
      } else if (matches(entry.name)) {
        kept.push(entry);
      }
    }

    return kept;
  };

  filtered[input.rootPath] = filterDir(input.rootPath);
  return { childrenByPath: filtered, displayOpenPaths };
}
