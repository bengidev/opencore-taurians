import type { ProjectTrunk } from "./projectTypes";

export interface ProjectDeletionEnumerateResult {
  trunkIds: string[];
  projectIds: string[];
  /** Worktree-backed child trunks whose managed-by-app=true require explicit confirmation */
  appManagedWorktreeTrunkIds: string[];
  /** Attached (non-managed) worktree child trunks — path doesn't get deleted */
  attachedWorktreeTrunkIds: string[];
}

/**
 * Enumerate trunks and projects to be deleted given a target trunk or project
 * as a starting point. Worktree-backed child trunks are identified so the
 * caller can present typed confirmation before proceeding with deletion.
 */
export function projectEnumerateDeletion(input: {
  targetTrunkId?: string;
  targetProjectId?: string;
  trunks: readonly ProjectTrunk[];
}): ProjectDeletionEnumerateResult {
  const { targetTrunkId, targetProjectId, trunks } = input;
  const trunkIds: string[] = [];
  const projectIds: string[] = [];
  const appManagedWorktreeTrunkIds: string[] = [];
  const attachedWorktreeTrunkIds: string[] = [];

  if (!targetTrunkId && !targetProjectId) {
    return { trunkIds, projectIds, appManagedWorktreeTrunkIds, attachedWorktreeTrunkIds };
  }

  if (targetTrunkId) {
    const targetTrunk = trunks.find((t) => t.id === targetTrunkId);
    if (!targetTrunk) {
      return { trunkIds, projectIds, appManagedWorktreeTrunkIds, attachedWorktreeTrunkIds };
    }

    // Collect the target and all descendants
    const subtree = collectSubtree(trunks, targetTrunkId);
    for (const trunk of subtree) {
      trunkIds.push(trunk.id);
      if (trunk.restore.gitCheckout.kind === "worktree") {
        if (trunk.restore.gitCheckout.managedByApp) {
          appManagedWorktreeTrunkIds.push(trunk.id);
        } else {
          attachedWorktreeTrunkIds.push(trunk.id);
        }
      }
    }

    // If deleting the last trunk of its project, include the project
    const siblingTrunks = trunks.filter(
      (t) => t.projectId === targetTrunk.projectId && !trunkIds.includes(t.id),
    );
    if (siblingTrunks.length === 0) {
      projectIds.push(targetTrunk.projectId);
    }
  } else if (targetProjectId) {
    const projectTrunks = trunks.filter((t) => t.projectId === targetProjectId);
    for (const trunk of projectTrunks) {
      trunkIds.push(trunk.id);
      if (trunk.restore.gitCheckout.kind === "worktree") {
        if (trunk.restore.gitCheckout.managedByApp) {
          appManagedWorktreeTrunkIds.push(trunk.id);
        } else {
          attachedWorktreeTrunkIds.push(trunk.id);
        }
      }
    }
    projectIds.push(targetProjectId);
  }

  return { trunkIds, projectIds, appManagedWorktreeTrunkIds, attachedWorktreeTrunkIds };
}

/** Recursively collect a trunk and all its descendants */
function collectSubtree(
  trunks: readonly ProjectTrunk[],
  rootId: string,
): ProjectTrunk[] {
  const result: ProjectTrunk[] = [];
  const root = trunks.find((t) => t.id === rootId);
  if (!root) return result;
  result.push(root);
  const children = trunks.filter((t) => t.parentTrunkId === rootId);
  for (const child of children) {
    result.push(...collectSubtree(trunks, child.id));
  }
  return result;
}

export type ProjectDeletionConfirmation =
  | { kind: "safe"; summary: string }
  | { kind: "app-managed-worktrees"; summary: string; appManagedPaths: string[] }
  | { kind: "attached-worktrees"; summary: string; attachedCount: number }
  | { kind: "project-deletion"; summary: string };
