import { useShellStore } from "../../shell/state/shellStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { useProjectStore } from "./projectStore";

export function projectActivateChunk(chunkId: string, nowIso = new Date().toISOString()): void {
  const state = useProjectStore.getState();
  const chunk = state.chunks.find((c) => c.id === chunkId);
  if (!chunk) return;
  const project = state.projects.find((p) => p.id === chunk.projectId);
  if (!project) return;
  state.touchChunkActivity(chunkId, nowIso);
  state.setActiveIds(project.id, chunk.id);
  useWorkspaceStore.getState().setWorkspace(project.folderPath);
  useShellStore.getState().setActiveMainCard(chunk.restore.activeMainCard);
}

export function projectActivateProject(projectId: string, nowIso = new Date().toISOString()): void {
  const state = useProjectStore.getState();
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const roots = state.chunks
    .filter((c) => c.projectId === projectId && c.parentChunkId === null)
    .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
  const target = roots[0];
  if (!target) return;
  projectActivateChunk(target.id, nowIso);
}

export function projectSyncRestoreFromShell(): void {
  const chunkId = useProjectStore.getState().activeChunkId;
  if (!chunkId) return;
  const card = useShellStore.getState().activeMainCard;
  useProjectStore.getState().setChunkRestore(chunkId, { activeMainCard: card });
}

export function projectOpenFolder(folderPath: string, nowIso = new Date().toISOString()) {
  const state = useProjectStore.getState();
  const existing = state.findProjectByFolderPath(folderPath);
  if (existing) {
    projectActivateProject(existing.id, nowIso);
    return {
      project: existing,
      chunk: state.chunks.find((c) => c.id === useProjectStore.getState().activeChunkId)!,
    };
  }
  const created = state.createProjectWithRootChunk({ folderPath, nowIso });
  useWorkspaceStore.getState().setWorkspace(folderPath);
  useShellStore.getState().setActiveMainCard(created.chunk.restore.activeMainCard);
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
  if (fresh.activeChunkId) {
    projectActivateChunk(fresh.activeChunkId, input.nowIso);
  } else if (input.workspacePath) {
    const project = fresh.findProjectByFolderPath(input.workspacePath);
    if (project) projectActivateProject(project.id, input.nowIso);
  }
}
