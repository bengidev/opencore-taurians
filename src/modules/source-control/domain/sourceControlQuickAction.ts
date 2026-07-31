import type { SourceControlRepositorySnapshot } from "../api/sourceControlContracts";

export type SourceControlQuickActionId = "fetch" | "pull" | "push" | "commit";

export interface SourceControlQuickActionAvailability {
  id: SourceControlQuickActionId;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export function resolveSourceControlQuickActions(
  snapshot: SourceControlRepositorySnapshot | null,
): SourceControlQuickActionAvailability[] {
  const actions: SourceControlQuickActionAvailability[] = [
    { id: "fetch", label: "Fetch", enabled: false, reason: null },
    { id: "pull", label: "Pull", enabled: false, reason: null },
    { id: "push", label: "Push", enabled: false, reason: null },
    { id: "commit", label: "Commit", enabled: false, reason: null },
  ];

  const hasConflicts = snapshot !== null && snapshot.conflictCount > 0;
  const isReady = snapshot !== null && snapshot.repositoryState === "ready";

  for (const action of actions) {
    if (!isReady) {
      action.enabled = false;
      action.reason = "No active repository";
      continue;
    }

    if (hasConflicts) {
      action.enabled = false;
      action.reason = "Resolve conflicts first";
      continue;
    }

    switch (action.id) {
      case "fetch": {
        action.enabled = snapshot!.remotes.length > 0;
        action.reason = action.enabled ? null : "No remote configured";
        break;
      }
      case "pull": {
        if (!snapshot!.upstream) {
          action.enabled = false;
          action.reason = "No upstream branch";
        } else if (snapshot!.behind === 0) {
          action.enabled = false;
          action.reason = "Up to date";
        } else {
          action.enabled = true;
          action.reason = null;
        }
        break;
      }
      case "push": {
        if (!snapshot!.upstream) {
          action.enabled = false;
          action.reason = "No upstream branch";
        } else if (snapshot!.ahead === 0) {
          action.enabled = false;
          action.reason = "Up to date";
        } else {
          action.enabled = true;
          action.reason = null;
        }
        break;
      }
      case "commit": {
        action.enabled =
          snapshot!.sectionCounts.changes > 0 ||
          snapshot!.sectionCounts.stagedChanges > 0;
        action.reason = action.enabled ? null : "Nothing to commit";
        break;
      }
    }
  }

  return actions;
}
