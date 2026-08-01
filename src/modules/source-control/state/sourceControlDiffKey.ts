export type DiffKind = "working-tree" | "staged";
export type DiffKey = `${DiffKind}:${string}`;

export function sourceControlDiffKey(kind: DiffKind, path: string): DiffKey {
  return `${kind}:${path}`;
}
