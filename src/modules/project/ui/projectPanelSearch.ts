import type { Project, ProjectTrunk, ProjectGroup } from "../domain/projectTypes";

export function projectSearchTitleTrunkIds(
  trunks: readonly ProjectTrunk[],
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
  for (const trunk of trunks) {
    if (trunk.title.toLowerCase().includes(q) || matchingProjectIds.has(trunk.projectId)) {
      ids.push(trunk.id);
    }
  }
  return ids;
}

export function projectExpandTrunkAncestors(
  trunks: readonly ProjectTrunk[],
  trunkIds: readonly string[],
): Set<string> {
  const byId = new Map(trunks.map((trunk) => [trunk.id, trunk]));
  const out = new Set<string>();
  for (const id of trunkIds) {
    let current: string | null = id;
    while (current) {
      if (out.has(current)) break;
      out.add(current);
      current = byId.get(current)?.parentTrunkId ?? null;
    }
  }
  return out;
}

export function projectProjectHasVisibleTrunks(
  projectId: string,
  trunks: readonly ProjectTrunk[],
  visibleTrunkIds: Set<string>,
): boolean {
  return trunks.some((trunk) => trunk.projectId === projectId && visibleTrunkIds.has(trunk.id));
}
