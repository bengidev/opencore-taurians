export function projectMergeSearchResults(input: {
  titleTrunkIds: readonly string[];
  messageTrunkIds: readonly string[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...input.titleTrunkIds, ...input.messageTrunkIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
