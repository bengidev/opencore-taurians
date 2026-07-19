import type { ProjectTrunk } from "./projectTypes";

export function projectIsRootTrunk(trunk: Pick<ProjectTrunk, "parentTrunkId">): boolean {
  return trunk.parentTrunkId === null;
}

export function projectIsChildTrunk(trunk: Pick<ProjectTrunk, "parentTrunkId">): boolean {
  return trunk.parentTrunkId !== null;
}

/** Trunks live in a flat list under each project — promote any nested rows to root level. */
export function projectFlattenTrunks(trunks: readonly ProjectTrunk[]): ProjectTrunk[] {
  return trunks.map((trunk) =>
    trunk.parentTrunkId === null ? trunk : { ...trunk, parentTrunkId: null },
  );
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

export function projectCollectTrunkWithChildrenIds(
  trunks: readonly ProjectTrunk[],
  trunkId: string,
): string[] {
  return trunks.some((trunk) => trunk.id === trunkId) ? [trunkId] : [];
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
