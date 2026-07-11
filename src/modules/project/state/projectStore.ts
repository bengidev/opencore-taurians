import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useChatStore } from "../../chat/state/chatStore";
import { createSessionPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { SESSION_PERSIST_KEYS } from "../../session/infrastructure/sessionPersistKeys";
import {
  projectCollectSubtreeChunkIds,
  projectListChildChunks,
  projectReorderSiblingChunks,
} from "../domain/projectChunkTree";
import { projectMigrateFromWorkspace } from "../domain/projectMigrate";
import {
  projectFolderBasename,
  projectNormalizeFolderPath,
} from "../domain/projectPath";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { projectSelectExpired } from "../domain/projectRetention";
import type {
  Project,
  ProjectChunk,
  ProjectChunkRestore,
  ProjectGroup,
} from "../domain/projectTypes";

function syncWorkspaceWhenNoProjects(projectCount: number): void {
  if (projectCount === 0) {
    useWorkspaceStore.getState().clearWorkspace();
  }
}

const EMPTY = {
  projects: [] as Project[],
  chunks: [] as ProjectChunk[],
  groups: [] as ProjectGroup[],
  activeProjectId: null as string | null,
  activeChunkId: null as string | null,
  expandedProjectIds: [] as string[],
  panelError: null as string | null,
};

export interface ProjectState {
  projects: Project[];
  chunks: ProjectChunk[];
  groups: ProjectGroup[];
  activeProjectId: string | null;
  activeChunkId: string | null;
  expandedProjectIds: string[];
  panelError: string | null;
  resetProjectState: () => void;
  setPanelError: (message: string | null) => void;
  createProjectWithRootChunk: (input: {
    folderPath: string;
    nowIso: string;
    projectId?: string;
    chunkId?: string;
  }) => { project: Project; chunk: ProjectChunk };
  addChildChunk: (input: {
    parentChunkId: string;
    title: string;
    nowIso: string;
  }) => ProjectChunk | null;
  addRootChunk: (input: {
    projectId: string;
    title: string;
    nowIso: string;
  }) => ProjectChunk | null;
  setProjectPinned: (projectId: string, pinned: boolean) => void;
  setChunkPinned: (chunkId: string, pinned: boolean) => void;
  setChunkRestore: (chunkId: string, restore: ProjectChunkRestore) => void;
  touchChunkActivity: (chunkId: string, nowIso: string) => void;
  setActiveIds: (projectId: string | null, chunkId: string | null) => void;
  toggleProjectExpanded: (projectId: string) => void;
  createManualGroup: (label: string) => ProjectGroup;
  assignProjectToGroup: (projectId: string, groupId: string | null) => void;
  reorderProjectsInGroup: (groupId: string, orderedProjectIds: string[]) => void;
  reorderSiblingChunks: (
    parentChunkId: string | null,
    orderedIds: string[],
  ) => void;
  findProjectByFolderPath: (folderPath: string) => Project | undefined;
  applyMigration: (workspacePath: string | null, nowIso: string) => void;
  updateProjectFolder: (projectId: string, folderPath: string) => void;
  deleteChunkCascade: (chunkId: string) => void;
  deleteProjectCascade: (projectId: string) => void;
  runRetentionSweep: (input: { nowMs: number; retentionDays: number }) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      resetProjectState: () => set({ ...EMPTY }),
      setPanelError: (message) => set({ panelError: message }),
      createProjectWithRootChunk: (input) => {
        const projectId = input.projectId ?? crypto.randomUUID();
        const chunkId = input.chunkId ?? crypto.randomUUID();
        const project: Project = {
          id: projectId,
          name: projectFolderBasename(input.folderPath),
          folderPath: projectNormalizeFolderPath(input.folderPath),
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          listOrder: get().projects.length,
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
        set((state) => ({
          projects: [...state.projects, project],
          chunks: [...state.chunks, chunk],
          activeProjectId: projectId,
          activeChunkId: chunkId,
          expandedProjectIds: state.expandedProjectIds.includes(projectId)
            ? state.expandedProjectIds
            : [...state.expandedProjectIds, projectId],
        }));
        return { project, chunk };
      },
      addChildChunk: (input) => {
        const parent = get().chunks.find((c) => c.id === input.parentChunkId);
        if (!parent) return null;
        const siblings = projectListChildChunks(get().chunks, parent.id);
        const chunk: ProjectChunk = {
          id: crypto.randomUUID(),
          projectId: parent.projectId,
          parentChunkId: parent.id,
          title: input.title,
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          restore: { activeMainCard: "chat" },
          siblingOrder: siblings.length,
        };
        set((state) => ({ chunks: [...state.chunks, chunk] }));
        return chunk;
      },
      addRootChunk: (input) => {
        if (!get().projects.some((p) => p.id === input.projectId)) return null;
        const siblings = projectListChildChunks(get().chunks, null).filter(
          (c) => c.projectId === input.projectId,
        );
        const chunk: ProjectChunk = {
          id: crypto.randomUUID(),
          projectId: input.projectId,
          parentChunkId: null,
          title: input.title,
          pinned: false,
          createdAt: input.nowIso,
          lastOpenedAt: input.nowIso,
          restore: { activeMainCard: "chat" },
          siblingOrder: siblings.length,
        };
        set((state) => ({ chunks: [...state.chunks, chunk] }));
        return chunk;
      },
      setProjectPinned: (projectId, pinned) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, pinned } : p,
          ),
        })),
      setChunkPinned: (chunkId, pinned) =>
        set((state) => ({
          chunks: state.chunks.map((c) =>
            c.id === chunkId ? { ...c, pinned } : c,
          ),
        })),
      setChunkRestore: (chunkId, restore) =>
        set((state) => ({
          chunks: state.chunks.map((c) =>
            c.id === chunkId ? { ...c, restore } : c,
          ),
        })),
      touchChunkActivity: (chunkId, nowIso) =>
        set((state) => {
          const chunk = state.chunks.find((c) => c.id === chunkId);
          if (!chunk) return state;
          return {
            chunks: state.chunks.map((c) =>
              c.id === chunkId ? { ...c, lastOpenedAt: nowIso } : c,
            ),
            projects: state.projects.map((p) =>
              p.id === chunk.projectId ? { ...p, lastOpenedAt: nowIso } : p,
            ),
          };
        }),
      setActiveIds: (projectId, chunkId) =>
        set({ activeProjectId: projectId, activeChunkId: chunkId }),
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
      reorderSiblingChunks: (parentChunkId, orderedIds) =>
        set((state) => ({
          chunks: projectReorderSiblingChunks(
            state.chunks,
            parentChunkId,
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
          chunks: [...state.chunks, migrated.chunk],
          activeProjectId: migrated.project.id,
          activeChunkId: migrated.chunk.id,
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
      deleteChunkCascade: (chunkId) => {
        const ids = projectCollectSubtreeChunkIds(get().chunks, chunkId);
        const idSet = new Set(ids);
        const chunk = get().chunks.find((c) => c.id === chunkId);
        useChatStore.getState().deleteByChunkIds(ids);
        set((state) => {
          const chunks = state.chunks.filter((c) => !idSet.has(c.id));
          const projectId = chunk?.projectId;
          const projectStillHasChunks = chunks.some(
            (c) => c.projectId === projectId,
          );
          const projects =
            projectId && !projectStillHasChunks
              ? state.projects.filter((p) => p.id !== projectId)
              : state.projects;
          return {
            chunks,
            projects,
            activeChunkId: idSet.has(state.activeChunkId ?? "")
              ? null
              : state.activeChunkId,
            activeProjectId:
              projectId &&
              !projectStillHasChunks &&
              state.activeProjectId === projectId
                ? null
                : state.activeProjectId,
          };
        });
        syncWorkspaceWhenNoProjects(get().projects.length);
      },
      deleteProjectCascade: (projectId) => {
        const ids = get()
          .chunks.filter((c) => c.projectId === projectId)
          .map((c) => c.id);
        useChatStore.getState().deleteByChunkIds(ids);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          chunks: state.chunks.filter((c) => c.projectId !== projectId),
          groups: state.groups.map((g) => ({
            ...g,
            projectIds: g.projectIds.filter((id) => id !== projectId),
          })),
          activeProjectId:
            state.activeProjectId === projectId ? null : state.activeProjectId,
          activeChunkId: ids.includes(state.activeChunkId ?? "")
            ? null
            : state.activeChunkId,
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
          chunks: get().chunks,
        });
        for (const chunkId of expired.chunkIds) {
          if (get().chunks.some((c) => c.id === chunkId)) {
            get().deleteChunkCascade(chunkId);
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
        chunks: state.chunks,
        groups: state.groups,
        activeProjectId: state.activeProjectId,
        activeChunkId: state.activeChunkId,
        expandedProjectIds: state.expandedProjectIds,
      }),
    },
  ),
);
