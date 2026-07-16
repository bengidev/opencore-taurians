import { projectCollectTrunkWithChildrenIds } from "./projectTrunkTree";
import type { Project, ProjectTrunk } from "./projectTypes";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ProjectRetentionResult {
  projectIds: string[];
  trunkIds: string[];
}

export function projectSelectExpired(input: {
  nowMs: number;
  retentionDays: number;
  projects: readonly Project[];
  trunks: readonly ProjectTrunk[];
}): ProjectRetentionResult {
  const cutoff = input.nowMs - input.retentionDays * MS_PER_DAY;
  const isStale = (iso: string) => Date.parse(iso) < cutoff;

  const pinnedTrunkProjectIds = new Set(
    input.trunks.filter((c) => c.pinned).map((c) => c.projectId),
  );

  const expiredTrunkIds = input.trunks
    .filter((c) => !c.pinned && isStale(c.lastOpenedAt))
    .filter((c) => {
      const project = input.projects.find((p) => p.id === c.projectId);
      return !(project?.pinned);
    })
    .map((c) => c.id);

  // If any trunk in a project is pinned, retain all trunks in that project for v1 simplicity
  // consistent with "ancestor project retained while pinned trunk exists".
  const retainAllTrunksForProjects = pinnedTrunkProjectIds;
  const retainedTrunkIds = new Set(
    input.trunks
      .filter((c) => c.pinned || !isStale(c.lastOpenedAt))
      .map((c) => c.id),
  );
  const trunkIds = expiredTrunkIds.filter((id) => {
    const trunk = input.trunks.find((c) => c.id === id);
    if (!trunk || retainAllTrunksForProjects.has(trunk.projectId)) return false;
    const subtree = projectCollectTrunkWithChildrenIds(input.trunks, id);
    return !subtree.some(
      (descendantId) =>
        descendantId !== id && retainedTrunkIds.has(descendantId),
    );
  });

  const projectIds = input.projects
    .filter((p) => !p.pinned)
    .filter((p) => isStale(p.lastOpenedAt))
    .filter((p) => !pinnedTrunkProjectIds.has(p.id))
    .filter(
      (p) =>
        !input.trunks.some(
          (c) => c.projectId === p.id && retainedTrunkIds.has(c.id),
        ),
    )
    .map((p) => p.id);

  return { projectIds, trunkIds };
}
