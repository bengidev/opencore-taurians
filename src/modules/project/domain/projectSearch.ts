export function projectMergeSearchResults(input: {
  titleChunkIds: readonly string[];
  messageChunkIds: readonly string[];
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...input.titleChunkIds, ...input.messageChunkIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
