import type { SourceControlRepositorySnapshot } from "../api/sourceControlContracts";

export type SourceControlBadgeKind = "none" | "conflict" | "ahead" | "behind" | "diverged" | "dirty";

export interface SourceControlBadge {
  kind: SourceControlBadgeKind;
  count: number;
}

const BADGE_CAP = 99;

export function resolveSourceControlBadge(snapshot: SourceControlRepositorySnapshot | null): SourceControlBadge {
  if (!snapshot) {
    return { kind: "none", count: 0 };
  }

  if (snapshot.conflictCount > 0) {
    return { kind: "conflict", count: Math.min(snapshot.conflictCount, BADGE_CAP) };
  }

  if (snapshot.ahead > 0 && snapshot.behind > 0) {
    return { kind: "diverged", count: Math.min(snapshot.ahead + snapshot.behind, BADGE_CAP) };
  }

  if (snapshot.sectionCounts.changes > 0) {
    return { kind: "dirty", count: Math.min(snapshot.sectionCounts.changes, BADGE_CAP) };
  }

  if (snapshot.ahead > 0) {
    return { kind: "ahead", count: Math.min(snapshot.ahead, BADGE_CAP) };
  }

  if (snapshot.behind > 0) {
    return { kind: "behind", count: Math.min(snapshot.behind, BADGE_CAP) };
  }

  return { kind: "none", count: 0 };
}
