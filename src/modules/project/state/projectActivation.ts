import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";

export function projectActivateTrunk(trunkId: string, nowIso = new Date().toISOString()): void {
  const state = useProjectStore.getState();
  const trunk = state.trunks.find((c) => c.id === trunkId);
  if (!trunk) return;
  const project = state.projects.find((p) => p.id === trunk.projectId);
  if (!project) return;
  state.touchTrunkActivity(trunkId, nowIso);
  state.setActiveIds(project.id, trunk.id);
  useWorkspaceStore.getState().setWorkspace(project.folderPath);
  useShellStore.getState().setActiveMainCard(trunk.restore.activeMainCard);
}

export function projectActivateProject(projectId: string, nowIso = new Date().toISOString()): void {
  const state = useProjectStore.getState();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const roots = state.trunks
    .filter((c) => c.projectId === projectId && c.parentTrunkId === null)
    .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
  const target = roots[0];
  if (!target) return;
  projectActivateTrunk(target.id, nowIso);
}

export function projectSyncRestoreFromShell(): void {
  const trunkId = useProjectStore.getState().activeTrunkId;
  if (!trunkId) return;
  const card = useShellStore.getState().activeMainCard;
  useProjectStore.getState().setTrunkRestore(trunkId, { activeMainCard: card });
}

export function projectOpenFolder(folderPath: string, nowIso = new Date().toISOString()) {
  const state = useProjectStore.getState();
  const existing = state.findProjectByFolderPath(folderPath);
  if (existing) {
    projectActivateProject(existing.id, nowIso);
    return {
      project: existing,
      trunk: state.trunks.find((c) => c.id === useProjectStore.getState().activeTrunkId)!,
    };
  }
  const created = state.createProjectWithRootTrunk({ folderPath, nowIso });
  useWorkspaceStore.getState().setWorkspace(folderPath);
  useShellStore.getState().setActiveMainCard(created.trunk.restore.activeMainCard);
  return created;
}

export function projectBootMigrateAndSweep(input: {
  workspacePath: string | null;
  nowIso: string;
  nowMs: number;
  retentionDays?: number;
}): void {
  const state = useProjectStore.getState();
  state.applyMigration(input.workspacePath, input.nowIso);
  state.runRetentionSweep({
    nowMs: input.nowMs,
    retentionDays: input.retentionDays ?? 30,
  });
  const fresh = useProjectStore.getState();
  if (fresh.activeTrunkId) {
    projectActivateTrunk(fresh.activeTrunkId, input.nowIso);
  } else if (input.workspacePath) {
    const project = fresh.findProjectByFolderPath(input.workspacePath);
    if (project) projectActivateProject(project.id, input.nowIso);
  }
}
