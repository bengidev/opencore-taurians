import { projectFolderBasename, projectNormalizeFolderPath } from "./projectPath";
import type { Project, ProjectChunk } from "./projectTypes";

export function projectMigrateFromWorkspace(input: {
  workspacePath: string | null;
  existingProjectCount: number;
  nowIso: string;
  projectId?: string;
  chunkId?: string;
}): { project: Project; chunk: ProjectChunk } | null {
  if (!input.workspacePath || input.existingProjectCount > 0) return null;
  const projectId = input.projectId ?? crypto.randomUUID();
  const chunkId = input.chunkId ?? crypto.randomUUID();
  const project: Project = {
    id: projectId,
    name: projectFolderBasename(input.workspacePath),
    folderPath: projectNormalizeFolderPath(input.workspacePath),
    pinned: false,
    createdAt: input.nowIso,
    lastOpenedAt: input.nowIso,
    listOrder: 0,
  };
  const chunk: ProjectChunk = {
    id: chunkId,
    projectId,
    parentChunkId: null,
    title: "Main",
    pinned: false,
    createdAt: input.nowIso,
    lastOpenedAt: input.nowIso,
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
  };
  return { project, chunk };
}
