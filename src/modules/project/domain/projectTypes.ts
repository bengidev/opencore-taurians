import type { ShellMainCard } from "../../shell/state/shellStore";

export type RightPanelFeature = "files" | "git";

export type GitCheckoutRestore =
  | {
      kind: "project-root";
      repositoryIdentity: string | null;
      savedRefName: string | null;
    }
  | {
      kind: "worktree";
      worktreePath: string;
      repositoryIdentity: string;
      savedRefName: string | null;
      managedByApp: boolean;
    };

export interface ProjectTrunkRestore {
  activeMainCard: ShellMainCard;
  rightPanelFeature: RightPanelFeature;
  gitCheckout: GitCheckoutRestore;
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
