import {
  createTauriSourceControlApi,
  type SourceControlApi,
  type SourceControlResolveCheckoutResult,
} from "../../source-control";
import { parsePublicSourceControlError } from "../../source-control/state/sourceControlErrorParsing";
import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import type { ProjectActivationResult } from "../domain/projectCheckout";
import { useProjectStore } from "./projectStore";

let activationGeneration = 0;

export async function projectActivateTrunk(
  trunkId: string,
  options: {
    nowIso?: string;
    sourceControlApi?: Pick<SourceControlApi, "resolveCheckout">;
  } = {},
): Promise<ProjectActivationResult> {
  const state = useProjectStore.getState();
  const trunk = state.trunks.find((item) => item.id === trunkId);
  if (!trunk) return { status: "not-found" };
  const project = state.projects.find((item) => item.id === trunk.projectId);
  if (!project) return { status: "not-found" };

  const generation = ++activationGeneration;
  const nowIso = options.nowIso ?? new Date().toISOString();
  const sourceControlApi = options.sourceControlApi ?? createTauriSourceControlApi();

  state.touchTrunkActivity(trunkId, nowIso);
  state.setActiveIds(project.id, trunk.id);
  state.setCheckoutRuntime(trunk.id, { status: "resolving" });
  useWorkspaceStore.getState().setWorkspace(project.folderPath);
  useShellStore.getState().setActiveMainCard(trunk.restore.activeMainCard);

  let result: SourceControlResolveCheckoutResult;
  try {
    result = await sourceControlApi.resolveCheckout({
      projectId: project.id,
      trunkId: trunk.id,
      projectFolderPath: project.folderPath,
      gitCheckout: trunk.restore.gitCheckout,
    });
  } catch (error) {
    if (!activationIsCurrent(generation, trunkId)) return { status: "superseded" };
    const publicError = parsePublicSourceControlError(error);
    useProjectStore.getState().setCheckoutRuntime(trunk.id, {
      status: "invalid",
      safeWorkspacePath: project.folderPath,
      reason: "unknown",
      message: publicError?.message ?? (error instanceof Error ? error.message : String(error)),
      worktreePath:
        trunk.restore.gitCheckout.kind === "worktree"
          ? trunk.restore.gitCheckout.worktreePath
          : null,
      repositoryIdentity: trunk.restore.gitCheckout.repositoryIdentity,
      savedRefName: trunk.restore.gitCheckout.savedRefName,
    });
    return { status: "checkout-invalid", reason: "unknown" };
  }

  if (!activationIsCurrent(generation, trunkId)) return { status: "superseded" };

  if (result.status === "invalid") {
    useWorkspaceStore.getState().setWorkspace(project.folderPath);
    useProjectStore.getState().setCheckoutRuntime(trunk.id, {
      status: "invalid",
      safeWorkspacePath: project.folderPath,
      reason: result.reason,
      message: result.message,
      worktreePath: result.worktreePath,
      repositoryIdentity: result.repositoryIdentity,
      savedRefName: result.savedRefName,
    });
    return { status: "checkout-invalid", reason: result.reason };
  }

  useWorkspaceStore.getState().setWorkspace(result.checkout.checkoutPath);
  useProjectStore.getState().setTrunkGitCheckout(
    trunk.id,
    result.checkout.normalizedRestore,
  );
  useProjectStore.getState().setCheckoutRuntime(trunk.id, {
    status: "ready",
    checkout: result.checkout,
  });
  return { status: "activated", checkout: result.checkout };
}

export async function projectActivateProject(
  projectId: string,
  options: Parameters<typeof projectActivateTrunk>[1] = {},
): Promise<ProjectActivationResult> {
  const state = useProjectStore.getState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return { status: "not-found" };
  const roots = state.trunks
    .filter((item) => item.projectId === projectId && item.parentTrunkId === null)
    .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
  const target = roots[0];
  return target
    ? projectActivateTrunk(target.id, options)
    : { status: "not-found" };
}

export function projectSyncRestoreFromShell(): void {
  const trunkId = useProjectStore.getState().activeTrunkId;
  if (!trunkId) return;
  const card = useShellStore.getState().activeMainCard;
  useProjectStore.getState().setTrunkActiveMainCard(trunkId, card);
}

export async function projectOpenFolder(
  folderPath: string,
  nowIso = new Date().toISOString(),
  sourceControlApi?: Pick<SourceControlApi, "resolveCheckout">,
) {
  const state = useProjectStore.getState();
  const existing = state.findProjectByFolderPath(folderPath);
  if (existing) {
    await projectActivateProject(existing.id, { nowIso, sourceControlApi });
    return {
      project: existing,
      trunk: state.trunks.find(
        (item) => item.id === useProjectStore.getState().activeTrunkId,
      )!,
    };
  }
  const created = state.createProjectWithRootTrunk({ folderPath, nowIso });
  await projectActivateTrunk(created.trunk.id, { nowIso, sourceControlApi });
  return created;
}

export async function projectBootMigrateAndSweep(input: {
  workspacePath: string | null;
  nowIso: string;
  nowMs: number;
  retentionDays?: number;
  sourceControlApi?: Pick<SourceControlApi, "resolveCheckout">;
}): Promise<void> {
  const state = useProjectStore.getState();
  state.applyMigration(input.workspacePath, input.nowIso);
  state.runRetentionSweep({
    nowMs: input.nowMs,
    retentionDays: input.retentionDays ?? 30,
  });
  const fresh = useProjectStore.getState();
  if (fresh.activeTrunkId) {
    await projectActivateTrunk(fresh.activeTrunkId, {
      nowIso: input.nowIso,
      sourceControlApi: input.sourceControlApi,
    });
  } else if (input.workspacePath) {
    const project = fresh.findProjectByFolderPath(input.workspacePath);
    if (project) {
      await projectActivateProject(project.id, {
        nowIso: input.nowIso,
        sourceControlApi: input.sourceControlApi,
      });
    }
  }
}

function activationIsCurrent(generation: number, trunkId: string): boolean {
  return (
    activationGeneration === generation &&
    useProjectStore.getState().activeTrunkId === trunkId
  );
}
