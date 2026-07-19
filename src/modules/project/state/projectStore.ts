import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useChatStore } from "../../chat/state/chatStore";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";
import {
  projectCollectTrunkWithChildrenIds,
  projectFlattenTrunks,
  projectListChildTrunks,
  projectReorderSiblingTrunks,
} from "../domain/projectTrunkTree";
import { DEFAULT_ROOT_TRUNK_TITLE } from "../domain/projectDefaults";
import { projectMigrateFromWorkspace } from "../domain/projectMigrate";
import {
  projectFolderBasename,
  projectNormalizeFolderPath,
} from "../domain/projectPath";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { projectSelectExpired } from "../domain/projectRetention";
import type {
  Project,
  ProjectTrunk,
  ProjectTrunkRestore,
  ProjectGroup,
} from "../domain/projectTypes";

function syncWorkspaceWhenNoProjects(projectCount: number): void {
  if (projectCount === 0) {
    useWorkspaceStore.getState().clearWorkspace();
  }
}

const EMPTY = {
  projects: [] as Project[],
  trunks: [] as ProjectTrunk[],
  groups: [] as ProjectGroup[],
  activeProjectId: null as string | null,
  activeTrunkId: null as string | null,
  expandedProjectIds: [] as string[],
  panelError: null as string | null,
};

export interface ProjectState {
  projects: Project[];
  trunks: ProjectTrunk[];
  groups: ProjectGroup[];
  activeProjectId: string | null;
  activeTrunkId: string | null;
  expandedProjectIds: string[];
  panelError: string | null;
  resetProjectState: () => void;
  setPanelError: (message: string | null) => void;
  createProjectWithRootTrunk: (input: {
    folderPath: string;
    nowIso: string;
    projectId?: string;
    trunkId?: string;
  }) => { project: Project; trunk: ProjectTrunk };
  addChildTrunk: (input: {
    parentTrunkId: string;
    title: string;
    nowIso: string;
  }) => ProjectTrunk | null;
  addRootTrunk: (input: {
    projectId: string;
    title: string;
    nowIso: string;
  }) => ProjectTrunk | null;
  setProjectPinned: (projectId: string, pinned: boolean) => void;
  setTrunkPinned: (trunkId: string, pinned: boolean) => void;
  setTrunkRestore: (trunkId: string, restore: ProjectTrunkRestore) => void;
  touchTrunkActivity: (trunkId: string, nowIso: string) => void;
  setActiveIds: (projectId: string | null, trunkId: string | null) => void;
  toggleProjectExpanded: (projectId: string) => void;
  createManualGroup: (label: string) => ProjectGroup;
  assignProjectToGroup: (projectId: string, groupId: string | null) => void;
  reorderProjectsInGroup: (groupId: string, orderedProjectIds: string[]) => void;
  reorderSiblingTrunks: (
    parentTrunkId: string | null,
    orderedIds: string[],
  ) => void;
  findProjectByFolderPath: (folderPath: string) => Project | undefined;
  applyMigration: (workspacePath: string | null, nowIso: string) => void;
  updateProjectFolder: (projectId: string, folderPath: string) => void;
  deleteTrunkCascade: (trunkId: string) => void;
  deleteProjectCascade: (projectId: string) => void;
  runRetentionSweep: (input: { nowMs: number; retentionDays: number }) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      resetProjectState: () => set({ ...EMPTY }),
      setPanelError: (message) => set({ panelError: message }),
      createProjectWithRootTrunk: (input) => {
        const projectId = input.projectId ?? crypto.randomUUID();
        const trunkId = input.trunkId ?? crypto.randomUUID();
        const project: Project = {
          id: projectId,
          name: projectFolderBasename(input.folderPath),
          folderPath: projectNormalizeFolderPath(input.folderPath),
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          listOrder: get().projects.length,
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
        set((state) => ({
          projects: [...state.projects, project],
          trunks: [...state.trunks, trunk],
          activeProjectId: projectId,
          activeTrunkId: trunkId,
          expandedProjectIds: state.expandedProjectIds.includes(projectId)
            ? state.expandedProjectIds
            : [...state.expandedProjectIds, projectId],
        }));
        return { project, trunk };
      },
      addChildTrunk: (_input) => null,
      addRootTrunk: (input) => {
        if (!get().projects.some((p) => p.id === input.projectId)) return null;
        const siblings = projectListChildTrunks(get().trunks, null).filter(
          (c) => c.projectId === input.projectId,
        );
        const trunk: ProjectTrunk = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          parentTrunkId: null,
          title: input.title,
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          restore: { activeMainCard: "chat" },
          siblingOrder: siblings.length,
        };
        set((state) => ({ trunks: [...state.trunks, trunk] }));
        return trunk;
      },
      setProjectPinned: (projectId, pinned) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, pinned } : p,
          ),
        })),
      setTrunkPinned: (trunkId, pinned) =>
        set((state) => ({
          trunks: state.trunks.map((c) =>
            c.id === trunkId ? { ...c, pinned } : c,
          ),
        })),
      setTrunkRestore: (trunkId, restore) =>
        set((state) => ({
          trunks: state.trunks.map((c) =>
            c.id === trunkId ? { ...c, restore } : c,
          ),
        })),
      touchTrunkActivity: (trunkId, nowIso) =>
        set((state) => {
          const trunk = state.trunks.find((c) => c.id === trunkId);
          if (!trunk) return state;
          return {
            trunks: state.trunks.map((c) =>
              c.id === trunkId ? { ...c, lastOpenedAt: nowIso } : c,
            ),
            projects: state.projects.map((p) =>
              p.id === trunk.projectId ? { ...p, lastOpenedAt: nowIso } : p,
            ),
          };
        }),
      setActiveIds: (projectId, trunkId) =>
        set({ activeProjectId: projectId, activeTrunkId: trunkId }),
      toggleProjectExpanded: (projectId) =>
        set((state) => ({
          expandedProjectIds: state.expandedProjectIds.includes(projectId)
            ? state.expandedProjectIds.filter((id) => id !== projectId)
            : [...state.expandedProjectIds, projectId],
        })),
      createManualGroup: (label) => {
        const group: ProjectGroup = {
          id: crypto.randomUUID(),
          label,
          projectIds: [],
          order: get().groups.length,
        };
        set((state) => ({ groups: [...state.groups, group] }));
        return group;
      },
      assignProjectToGroup: (projectId, groupId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, manualGroupId: groupId ?? undefined }
              : p,
          ),
          groups: state.groups.map((g) => ({
            ...g,
            projectIds:
              g.id === groupId
                ? g.projectIds.includes(projectId)
                  ? g.projectIds
                  : [...g.projectIds, projectId]
                : g.projectIds.filter((id) => id !== projectId),
          })),
        })),
      reorderProjectsInGroup: (groupId, orderedProjectIds) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, projectIds: [...orderedProjectIds] } : g,
          ),
        })),
      reorderSiblingTrunks: (parentTrunkId, orderedIds) =>
        set((state) => ({
          trunks: projectReorderSiblingTrunks(
            state.trunks,
            parentTrunkId,
            orderedIds,
          ),
        })),
      findProjectByFolderPath: (folderPath) => {
        const normalized = projectNormalizeFolderPath(folderPath);
        return get().projects.find(
          (p) => projectNormalizeFolderPath(p.folderPath) === normalized,
        );
      },
      applyMigration: (workspacePath, nowIso) => {
        const migrated = projectMigrateFromWorkspace({
          workspacePath,
          existingProjectCount: get().projects.length,
          nowIso,
        });
        if (!migrated) return;
        set((state) => ({
          projects: [...state.projects, migrated.project],
          trunks: [...state.trunks, migrated.trunk],
          activeProjectId: migrated.project.id,
          activeTrunkId: migrated.trunk.id,
          expandedProjectIds: [...state.expandedProjectIds, migrated.project.id],
        }));
      },
      updateProjectFolder: (projectId, folderPath) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  folderPath: projectNormalizeFolderPath(folderPath),
                  name: projectFolderBasename(folderPath),
                }
              : p,
          ),
        })),
      deleteTrunkCascade: (trunkId) => {
        const ids = projectCollectTrunkWithChildrenIds(get().trunks, trunkId);
        const idSet = new Set(ids);
        const trunk = get().trunks.find((c) => c.id === trunkId);
        useChatStore.getState().deleteByTrunkIds(ids);
        set((state) => {
          const trunks = state.trunks.filter((c) => !idSet.has(c.id));
          const projectId = trunk?.projectId;
          const projectStillHasTrunks = trunks.some(
            (c) => c.projectId === projectId,
          );
          const projects =
            projectId && !projectStillHasTrunks
              ? state.projects.filter((p) => p.id !== projectId)
              : state.projects;
          return {
            trunks,
            projects,
            activeTrunkId: idSet.has(state.activeTrunkId ?? "")
              ? null
              : state.activeTrunkId,
            activeProjectId:
              projectId &&
              !projectStillHasTrunks &&
              state.activeProjectId === projectId
                ? null
                : state.activeProjectId,
          };
        });
        syncWorkspaceWhenNoProjects(get().projects.length);
      },
      deleteProjectCascade: (projectId) => {
        const ids = get()
          .trunks.filter((c) => c.projectId === projectId)
          .map((c) => c.id);
        useChatStore.getState().deleteByTrunkIds(ids);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          trunks: state.trunks.filter((c) => c.projectId !== projectId),
          groups: state.groups.map((g) => ({
            ...g,
            projectIds: g.projectIds.filter((id) => id !== projectId),
          })),
          activeProjectId:
            state.activeProjectId === projectId ? null : state.activeProjectId,
          activeTrunkId: ids.includes(state.activeTrunkId ?? "")
            ? null
            : state.activeTrunkId,
          expandedProjectIds: state.expandedProjectIds.filter(
            (id) => id !== projectId,
          ),
        }));
        syncWorkspaceWhenNoProjects(get().projects.length);
      },
      runRetentionSweep: (input) => {
        const expired = projectSelectExpired({
          nowMs: input.nowMs,
          retentionDays: input.retentionDays,
          projects: get().projects,
          trunks: get().trunks,
        });
        for (const trunkId of expired.trunkIds) {
          if (get().trunks.some((c) => c.id === trunkId)) {
            get().deleteTrunkCascade(trunkId);
          }
        }
        for (const projectId of expired.projectIds) {
          if (get().projects.some((p) => p.id === projectId)) {
            get().deleteProjectCascade(projectId);
          }
        }
        syncWorkspaceWhenNoProjects(get().projects.length);
      },
    }),
    {
      name: SESSION_PERSIST_KEYS.project,
      storage: createSessionPersistStorage(),
      partialize: (state) => ({
        projects: state.projects,
        trunks: state.trunks,
        groups: state.groups,
        activeProjectId: state.activeProjectId,
        activeTrunkId: state.activeTrunkId,
        expandedProjectIds: state.expandedProjectIds,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<ProjectState>) };
        const trunks = projectFlattenTrunks(merged.trunks ?? []);
        const trunkIds = new Set(trunks.map((trunk) => trunk.id));
        return {
          ...merged,
          trunks,
          activeTrunkId:
            merged.activeTrunkId && trunkIds.has(merged.activeTrunkId)
              ? merged.activeTrunkId
              : null,
        };
      },
    },
  ),
);
