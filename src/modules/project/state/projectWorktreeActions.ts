import type { ProjectCheckoutRuntimeState } from "../domain/projectCheckout";
import type { ProjectTrunk } from "../domain/projectTypes";
import { projectEnumerateDeletion } from "../domain/projectDeletionActions";

/**
 * Create a worktree-backed child trunk: native succeeds → metadata committed.
 * Caller provides a gitApi.createWorktree that returns the checkout result;
 * on success the checkout runtime and trunk metadata are persisted.
 */
export async function projectCreateChildTrunk(input: {
  parentTrunkId: string;
  baseRefName: string;
  branchName: string;
  historyMode: "normal" | "orphan";
  nowIso: string;
  gitApi: {
    createWorktree(params: {
      projectId: string;
      parentTrunkId: string;
      trunkId: string;
      projectFolderPath: string;
      baseRefName: string;
      branchName: string;
      historyMode: "normal" | "orphan";
    }): Promise<{ checkoutPath: string; repositoryIdentity: string; savedRefName: string | null }>;
  };
  store: {
    createChildTrunk(params: {
      parentTrunkId: string;
      title: string;
      nowIso: string;
      gitCheckout: import("../domain/projectTypes").SourceControlCheckoutRestore;
    }): ProjectTrunk | null;
    setCheckoutRuntime(trunkId: string, runtime: ProjectCheckoutRuntimeState): void;
  };
}): Promise<{ trunkId: string; checkoutPath: string }> {
  const trunkId = crypto.randomUUID();
  const parentTrunk = input.store.createChildTrunk({
    parentTrunkId: input.parentTrunkId,
    title: input.branchName,
    nowIso: input.nowIso,
    gitCheckout: {
      kind: "worktree",
      worktreePath: "",
      repositoryIdentity: "",
      savedRefName: input.branchName,
      managedByApp: true,
    },
  });
  if (!parentTrunk) {
    throw new Error("Parent trunk not found");
  }

  try {
    const result = await input.gitApi.createWorktree({
      projectId: "resolved-at-runtime",
      parentTrunkId: input.parentTrunkId,
      trunkId,
      projectFolderPath: "",
      baseRefName: input.baseRefName,
      branchName: input.branchName,
      historyMode: input.historyMode,
    });

    input.store.setCheckoutRuntime(trunkId, {
      status: "ready",
      checkout: {
        kind: "worktree",
        checkoutPath: result.checkoutPath,
        checkoutIdentity: result.checkoutPath,
        repositoryIdentity: result.repositoryIdentity,
        savedRefName: result.savedRefName,
        managedByApp: true,
        normalizedRestore: {
          kind: "worktree",
          worktreePath: result.checkoutPath,
          repositoryIdentity: result.repositoryIdentity,
          savedRefName: result.savedRefName,
          managedByApp: true,
        },
      },
    });

    return { trunkId, checkoutPath: result.checkoutPath };
  } catch {
    throw new Error("Failed to create child worktree");
  }
}

/**
 * Enumerate delete consequences for a trunk or project, producing typed
 * confirmation data for the caller to present before destructive actions.
 */
export function projectPrepareDeletion(input: {
  targetTrunkId?: string;
  targetProjectId?: string;
  trunks: readonly ProjectTrunk[];
}): ReturnType<typeof projectEnumerateDeletion> {
  return projectEnumerateDeletion(input);
}
