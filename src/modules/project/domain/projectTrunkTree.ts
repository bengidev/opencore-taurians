import type { ProjectTrunk } from "./projectTypes";

export function projectIsRootTrunk(trunk: Pick<ProjectTrunk, "parentTrunkId">): boolean {
  return trunk.parentTrunkId === null;
}

export function projectListChildTrunks(
  trunks: readonly ProjectTrunk[],
  parentTrunkId: string | null,
): ProjectTrunk[] {
  return trunks
    .filter((c) => c.parentTrunkId === parentTrunkId)
    .slice()
    .sort((a, b) => a.siblingOrder - b.siblingOrder || a.title.localeCompare(b.title));
}

/** Root trunk id plus direct children only (no deeper descendants). */
export function projectCollectTrunkWithChildrenIds(
  trunks: readonly ProjectTrunk[],
  trunkId: string,
): string[] {
  const trunk = trunks.find((candidate) => candidate.id === trunkId);
  if (!trunk || !projectIsRootTrunk(trunk)) return [trunkId];
  const childIds = projectListChildTrunks(trunks, trunkId).map((child) => child.id);
  return [trunkId, ...childIds];
}

export function projectReorderSiblingTrunks(
  trunks: readonly ProjectTrunk[],
  parentTrunkId: string | null,
  orderedIds: readonly string[],
): ProjectTrunk[] {
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return trunks.map((trunk) => {
    if (trunk.parentTrunkId !== parentTrunkId || !order.has(trunk.id)) return trunk;
    return { ...trunk, siblingOrder: order.get(trunk.id)! };
  });
}
