import { projectFolderBasename, projectParentDirectoryPath } from "./projectPath";
import type { Project } from "./projectTypes";

export interface ProjectAutoGroup {
  key: string;
  label: string;
  projectIds: string[];
}

export function projectBuildAutoGroups(
  projects: readonly Project[],
): ProjectAutoGroup[] {
  const map = new Map<string, string[]>();
  for (const project of projects) {
    if (project.manualGroupId) continue;
    const key = projectParentDirectoryPath(project.folderPath);
    const list = map.get(key) ?? [];
    list.push(project.id);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, projectIds]) => ({
      key,
      label: projectFolderBasename(key),
      projectIds,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
