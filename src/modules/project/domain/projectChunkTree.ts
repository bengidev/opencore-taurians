import type { ProjectChunk } from "./projectTypes";

export function projectListChildChunks(
  chunks: readonly ProjectChunk[],
  parentChunkId: string | null,
): ProjectChunk[] {
  return chunks
    .filter((c) => c.parentChunkId === parentChunkId)
    .slice()
    .sort((a, b) => a.siblingOrder - b.siblingOrder || a.title.localeCompare(b.title));
}

export function projectCollectSubtreeChunkIds(
  chunks: readonly ProjectChunk[],
  rootId: string,
): string[] {
  const byParent = new Map<string | null, ProjectChunk[]>();
  for (const chunk of chunks) {
    const list = byParent.get(chunk.parentChunkId) ?? [];
    list.push(chunk);
    byParent.set(chunk.parentChunkId, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    for (const child of byParent.get(id) ?? []) stack.push(child.id);
  }
  return out;
}

export function projectReorderSiblingChunks(
  chunks: readonly ProjectChunk[],
  parentChunkId: string | null,
  orderedIds: readonly string[],
): ProjectChunk[] {
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return chunks.map((chunk) => {
    if (chunk.parentChunkId !== parentChunkId || !order.has(chunk.id)) return chunk;
    return { ...chunk, siblingOrder: order.get(chunk.id)! };
  });
}
