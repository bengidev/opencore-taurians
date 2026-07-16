import type { ShellMainCard } from "../../shell/state/shellStore";

export interface ProjectTrunkRestore {
  activeMainCard: ShellMainCard;
}

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  pinned: boolean;
  createdAt: string;
  lastOpenedAt: string;
  manualGroupId?: string;
  listOrder: number;
}

export interface ProjectTrunk {
  id: string;
  projectId: string;
  parentTrunkId: string | null;
  title: string;
  pinned: boolean;
  createdAt: string;
  lastOpenedAt: string;
  restore: ProjectTrunkRestore;
  siblingOrder: number;
}

export interface ProjectGroup {
  id: string;
  label: string;
  projectIds: string[];
  order: number;
}
