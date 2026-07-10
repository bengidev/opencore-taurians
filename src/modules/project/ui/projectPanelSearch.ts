import type { Project, ProjectChunk, ProjectGroup } from "../domain/projectTypes";

export function projectSearchTitleChunkIds(
  chunks: readonly ProjectChunk[],
  projects: readonly Project[],
  groups: readonly ProjectGroup[],
  query: string,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matchingProjectIds = new Set<string>();
  for (const project of projects) {
    if (project.name.toLowerCase().includes(q)) {
      matchingProjectIds.add(project.id);
    }
  }
  for (const group of groups) {
    if (group.label.toLowerCase().includes(q)) {
      for (const projectId of group.projectIds) {
        matchingProjectIds.add(projectId);
      }
    }
  }

  const ids: string[] = [];
  for (const chunk of chunks) {
    if (chunk.title.toLowerCase().includes(q) || matchingProjectIds.has(chunk.projectId)) {
      ids.push(chunk.id);
    }
  }
  return ids;
}

export function projectExpandChunkAncestors(
  chunks: readonly ProjectChunk[],
  chunkIds: readonly string[],
): Set<string> {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const out = new Set<string>();
  for (const id of chunkIds) {
    let current: string | null = id;
    while (current) {
      if (out.has(current)) break;
      out.add(current);
      current = byId.get(current)?.parentChunkId ?? null;
    }
  }
  return out;
}

export function projectProjectHasVisibleChunks(
  projectId: string,
  chunks: readonly ProjectChunk[],
  visibleChunkIds: Set<string>,
): boolean {
  return chunks.some((chunk) => chunk.projectId === projectId && visibleChunkIds.has(chunk.id));
}
