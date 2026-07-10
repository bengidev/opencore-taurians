import type { Project, ProjectChunk } from "./projectTypes";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ProjectRetentionResult {
  projectIds: string[];
  chunkIds: string[];
}

export function projectSelectExpired(input: {
  nowMs: number;
  retentionDays: number;
  projects: readonly Project[];
  chunks: readonly ProjectChunk[];
}): ProjectRetentionResult {
  const cutoff = input.nowMs - input.retentionDays * MS_PER_DAY;
  const isStale = (iso: string) => Date.parse(iso) < cutoff;

  const pinnedChunkProjectIds = new Set(
    input.chunks.filter((c) => c.pinned).map((c) => c.projectId),
  );

  const expiredChunkIds = input.chunks
    .filter((c) => !c.pinned && isStale(c.lastOpenedAt))
    .filter((c) => {
      const project = input.projects.find((p) => p.id === c.projectId);
      return !(project?.pinned);
    })
    .map((c) => c.id);

  // If any chunk in a project is pinned, retain all chunks in that project for v1 simplicity
  // consistent with "ancestor project retained while pinned chunk exists".
  const retainAllChunksForProjects = pinnedChunkProjectIds;
  const chunkIds = expiredChunkIds.filter((id) => {
    const chunk = input.chunks.find((c) => c.id === id);
    return chunk ? !retainAllChunksForProjects.has(chunk.projectId) : false;
  });

  const projectIds = input.projects
    .filter((p) => !p.pinned)
    .filter((p) => isStale(p.lastOpenedAt))
    .filter((p) => !pinnedChunkProjectIds.has(p.id))
    .map((p) => p.id);

  return { projectIds, chunkIds };
}
