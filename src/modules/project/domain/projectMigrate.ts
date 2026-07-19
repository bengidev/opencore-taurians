import { DEFAULT_ROOT_TRUNK_TITLE } from "./projectDefaults";
import { projectFolderBasename, projectNormalizeFolderPath } from "./projectPath";
import type { Project, ProjectTrunk } from "./projectTypes";

export function projectMigrateFromWorkspace(input: {
  workspacePath: string | null;
  existingProjectCount: number;
  nowIso: string;
  projectId?: string;
  trunkId?: string;
}): { project: Project; trunk: ProjectTrunk } | null {
  if (!input.workspacePath || input.existingProjectCount > 0) return null;
  const projectId = input.projectId ?? crypto.randomUUID();
  const trunkId = input.trunkId ?? crypto.randomUUID();
  const project: Project = {
    id: projectId,
    name: projectFolderBasename(input.workspacePath),
    folderPath: projectNormalizeFolderPath(input.workspacePath),
    pinned: false,
    createdAt: input.nowIso,
    lastOpenedAt: input.nowIso,
    listOrder: 0,
  };
  const trunk: ProjectTrunk = {
    id: trunkId,
    projectId,
    parentTrunkId: null,
    title: DEFAULT_ROOT_TRUNK_TITLE,
    pinned: false,
    createdAt: input.nowIso,
    lastOpenedAt: input.nowIso,
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
  };
  return { project, trunk };
}
