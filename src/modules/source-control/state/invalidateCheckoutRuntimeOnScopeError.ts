import { useProjectStore } from "../../project/state/projectStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { parsePublicSourceControlError } from "./parsePublicSourceControlError";

export function invalidateCheckoutRuntimeOnScopeError(
  trunkId: string,
  error: unknown,
): void {
  const publicError = parsePublicSourceControlError(error);
  if (publicError?.code !== "checkout-invalid") return;

  const projectState = useProjectStore.getState();
  const trunk = projectState.trunks.find((item) => item.id === trunkId);
  if (!trunk) return;
  const project = projectState.projects.find((item) => item.id === trunk.projectId);
  if (!project) return;

  useWorkspaceStore.getState().setWorkspace(project.folderPath);
  useProjectStore.getState().setCheckoutRuntime(trunkId, {
    status: "invalid",
    safeWorkspacePath: project.folderPath,
    reason: "unknown",
    message: publicError.message,
    worktreePath:
      trunk.restore.gitCheckout.kind === "worktree"
        ? trunk.restore.gitCheckout.worktreePath
        : null,
    repositoryIdentity: trunk.restore.gitCheckout.repositoryIdentity,
    savedRefName: trunk.restore.gitCheckout.savedRefName,
  });
}
