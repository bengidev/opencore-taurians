import { isUntitledId } from "../state/editorTabId";
import type { EditorBuffer } from "../state/editorStore";

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? path : path.slice(0, index);
}

function isUnderProjectRoot(projectRoot: string, path: string): boolean {
  return path === projectRoot || path.startsWith(`${projectRoot}/`);
}

export function collectDirtyExplorerPaths(
  buffers: Record<string, EditorBuffer>,
  projectRoot: string | null,
): Set<string> {
  const out = new Set<string>();
  if (!projectRoot) return out;

  for (const [id, buffer] of Object.entries(buffers)) {
    if (!buffer.dirty || buffer.readOnly || isUntitledId(id)) continue;
    if (!isUnderProjectRoot(projectRoot, id)) continue;

    let current: string | null = id;
    while (current && isUnderProjectRoot(projectRoot, current)) {
      out.add(current);
      if (current === projectRoot) break;
      const parent = parentDir(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return out;
}
