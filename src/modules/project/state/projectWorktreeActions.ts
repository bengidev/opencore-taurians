import type { ResolvedSourceControlCheckout } from "../../source-control/api/sourceControlContracts";
import {
  createTauriSourceControlApi,
  type SourceControlApi,
} from "../../source-control";
import type { ProjectCheckoutRuntimeState } from "../domain/projectCheckout";
import type { ProjectTrunk } from "../domain/projectTypes";
import { projectEnumerateDeletion } from "../domain/projectDeletionActions";
import { useProjectStore } from "./projectStore";

/**
 * Create a worktree-backed child trunk: native succeeds, then metadata is committed.
 */
export async function projectCreateChildTrunk(input: {
  projectId: string;
  projectFolderPath: string;
  parentTrunkId: string;
  parentScopeId: string;
  baseRefName: string;
  branchName: string;
  historyMode: "normal" | "orphan";
  nowIso: string;
  sourceControlApi?: Pick<SourceControlApi, "createWorktree">;
}): Promise<{ trunk: ProjectTrunk; checkout: ResolvedSourceControlCheckout }> {
  void input.parentScopeId;
  const trunkId = crypto.randomUUID();
  const sourceControlApi = input.sourceControlApi ?? createTauriSourceControlApi();

  let result;
  try {
    result = await sourceControlApi.createWorktree({
      projectId: input.projectId,
      parentTrunkId: input.parentTrunkId,
      trunkId,
      projectFolderPath: input.projectFolderPath,
      baseRefName: input.baseRefName,
      branchName: input.branchName,
      historyMode: input.historyMode,
    });
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }

  const trunk = useProjectStore.getState().addChildTrunk({
    trunkId,
    parentTrunkId: input.parentTrunkId,
    title: input.branchName,
    nowIso: input.nowIso,
    gitCheckout: result.checkout.normalizedRestore,
  });
  if (!trunk) {
    throw new Error("Parent trunk not found");
  }

  const runtime: ProjectCheckoutRuntimeState = {
    status: "ready",
    checkout: result.checkout,
  };
  useProjectStore.getState().setCheckoutRuntime(trunkId, runtime);

  return { trunk, checkout: result.checkout };
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

/**
 * Inspect and remove managed worktrees, then delete Project metadata.
 * Attached worktrees only lose metadata.
 */
export async function projectExecuteDeletion(input: {
  targetTrunkId: string;
  sourceControlApi?: Pick<
    SourceControlApi,
    "inspectWorktreeRemoval" | "removeWorktree"
  >;
}): Promise<void> {
  const state = useProjectStore.getState();
  const enumeration = projectEnumerateDeletion({
    targetTrunkId: input.targetTrunkId,
    trunks: state.trunks,
  });
  const sourceControlApi =
    input.sourceControlApi ?? createTauriSourceControlApi();

  for (const trunkId of enumeration.appManagedWorktreeTrunkIds) {
    const trunk = state.trunks.find((item) => item.id === trunkId);
    if (!trunk || trunk.restore.gitCheckout.kind !== "worktree") continue;
    const checkout = trunk.restore.gitCheckout;
    const runtime = state.checkoutRuntimeByTrunkId[trunkId];
    const scopeId =
      runtime?.status === "ready" ? runtime.checkout.scopeId : null;

    const inspection = await sourceControlApi.inspectWorktreeRemoval({
      worktreePath: checkout.worktreePath,
      repositoryIdentity: checkout.repositoryIdentity,
    });

    await sourceControlApi.removeWorktree({
      scopeId,
      worktreePath: checkout.worktreePath,
      repositoryIdentity: checkout.repositoryIdentity,
      expectedHeadOid: inspection.headOid,
      allowDirty: false,
      allowUnmergedChanges: false,
      allowUnmergedCommits: false,
    });
  }

  useProjectStore.getState().deleteTrunkCascade(input.targetTrunkId);
}
