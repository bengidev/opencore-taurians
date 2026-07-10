import type { ShellMainCard } from "../../shell/state/shellStore";

export interface ProjectChunkRestore {
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

export interface ProjectChunk {
  id: string;
  projectId: string;
  parentChunkId: string | null;
  title: string;
  pinned: boolean;
  createdAt: string;
  lastOpenedAt: string;
  restore: ProjectChunkRestore;
  siblingOrder: number;
}

export interface ProjectGroup {
  id: string;
  label: string;
  projectIds: string[];
  order: number;
}
