import {
  ChevronDown,
  ChevronRight,
  FolderInput,
  FolderSync,
  FolderX,
  Pin,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useChatStore } from "../../chat/state/chatStore";
import {
  createTauriFolderPicker,
  type FolderPicker,
} from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { projectBuildAutoGroups } from "../domain/projectAutoGroup";
import type { Project } from "../domain/projectTypes";
import { projectMergeSearchResults } from "../domain/projectSearch";
import { projectActivateChunk, projectOpenFolder } from "../state/projectActivation";
import { useProjectStore } from "../state/projectStore";
import { PanelToolButton } from "./panelToolButton";
import { PanelTooltip } from "./panelTooltip";
import { ProjectChunkTree } from "./projectChunkTree";
import {
  projectExpandChunkAncestors,
  projectProjectHasVisibleChunks,
  projectSearchTitleChunkIds,
} from "./projectPanelSearch";

const NEW_CHUNK_TITLE = "New chunk";
const PROJECT_DRAG_ID_MIME = "application/x-project-id";
const PROJECT_DRAG_GROUP_MIME = "application/x-project-group-id";

function reorderProjectsInManualGroup(
  groupId: string,
  sourceProjectId: string,
  targetProjectId: string,
) {
  if (sourceProjectId === targetProjectId) return;
  const group = useProjectStore.getState().groups.find((g) => g.id === groupId);
  if (!group) return;
  const ids = [...group.projectIds];
  const sourceIndex = ids.indexOf(sourceProjectId);
  const targetIndex = ids.indexOf(targetProjectId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const reordered = [...ids];
  reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, sourceProjectId);
  useProjectStore.getState().reorderProjectsInGroup(groupId, reordered);
}

export interface ProjectLeftPanelProps {
  onRequestOpenProject?: () => void;
  folderPicker?: FolderPicker;
}

function ProjectRow({
  project,
  chunks,
  activeChunkId,
  expanded,
  visibleChunkIds,
  onToggleExpanded,
  onRelinkFolder,
}: {
  project: Project;
  chunks: ReturnType<typeof useProjectStore.getState>["chunks"];
  activeChunkId: string | null;
  expanded: boolean;
  visibleChunkIds: Set<string> | undefined;
  onToggleExpanded: () => void;
  onRelinkFolder: () => void;
}) {
  const handleMoveToGroup = () => {
    const label = window.prompt("Group name");
    if (!label?.trim()) return;
    const store = useProjectStore.getState();
    const trimmed = label.trim();
    const existing = store.groups.find((g) => g.label === trimmed);
    const group = existing ?? store.createManualGroup(trimmed);
    store.assignProjectToGroup(project.id, group.id);
  };

  const handleRemoveFromGroup = () => {
    useProjectStore.getState().assignProjectToGroup(project.id, null);
  };

  return (
    <li className="min-w-0">
      <div className="flex min-w-0 w-full items-center gap-0.5">
        <PanelTooltip label={project.name}>
          <button
            type="button"
            draggable={Boolean(project.manualGroupId)}
            aria-expanded={expanded}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-sm px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-foreground hover:bg-muted/60",
            )}
            onClick={onToggleExpanded}
            onDragStart={
              project.manualGroupId
                ? (event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(PROJECT_DRAG_ID_MIME, project.id);
                    event.dataTransfer.setData(PROJECT_DRAG_GROUP_MIME, project.manualGroupId!);
                  }
                : undefined
            }
            onDragOver={
              project.manualGroupId
                ? (event) => {
                    event.preventDefault();
                  }
                : undefined
            }
            onDrop={
              project.manualGroupId
                ? (event) => {
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData(PROJECT_DRAG_ID_MIME);
                    const groupId = event.dataTransfer.getData(PROJECT_DRAG_GROUP_MIME);
                    if (groupId !== project.manualGroupId) return;
                    reorderProjectsInManualGroup(groupId, sourceId, project.id);
                  }
                : undefined
            }
          >
            {expanded ? (
              <ChevronDown className="size-3 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="size-3 shrink-0" aria-hidden />
            )}
            <span className="truncate">{project.name}</span>
          </button>
        </PanelTooltip>
        <PanelToolButton
          label={
            project.pinned ? `Unpin project ${project.name}` : `Pin project ${project.name}`
          }
          onClick={(event) => {
            event.stopPropagation();
            useProjectStore.getState().setProjectPinned(project.id, !project.pinned);
          }}
        >
          <Pin className="size-3" aria-hidden />
        </PanelToolButton>
        {project.manualGroupId ? (
          <PanelToolButton
            label={`Remove ${project.name} from group`}
            onClick={(event) => {
              event.stopPropagation();
              handleRemoveFromGroup();
            }}
          >
            <FolderX className="size-3" aria-hidden />
          </PanelToolButton>
        ) : (
          <PanelToolButton
            label={`Move ${project.name} to group`}
            onClick={(event) => {
              event.stopPropagation();
              handleMoveToGroup();
            }}
          >
            <FolderInput className="size-3" aria-hidden />
          </PanelToolButton>
        )}
        <PanelToolButton
          label="Add root chunk"
          onClick={(event) => {
            event.stopPropagation();
            const chunk = useProjectStore.getState().addRootChunk({
              projectId: project.id,
              title: NEW_CHUNK_TITLE,
              nowIso: new Date().toISOString(),
            });
            if (chunk) projectActivateChunk(chunk.id);
          }}
        >
          <Plus className="size-3" aria-hidden />
        </PanelToolButton>
        <PanelToolButton
          label="Relink folder"
          onClick={(event) => {
            event.stopPropagation();
            void onRelinkFolder();
          }}
        >
          <FolderSync className="size-3" aria-hidden />
        </PanelToolButton>
      </div>
      {expanded ? (
        <ProjectChunkTree
          projectId={project.id}
          chunks={chunks}
          activeChunkId={activeChunkId}
          visibleChunkIds={visibleChunkIds}
        />
      ) : null}
    </li>
  );
}

function ProjectSection({
  label,
  projectIds,
  projectsById,
  chunks,
  activeChunkId,
  expandedProjectIds,
  visibleChunkIds,
  isSearching,
  searchQuery,
  onRelinkFolder,
}: {
  label: string;
  projectIds: string[];
  projectsById: Map<string, Project>;
  chunks: ReturnType<typeof useProjectStore.getState>["chunks"];
  activeChunkId: string | null;
  expandedProjectIds: string[];
  visibleChunkIds: Set<string> | undefined;
  isSearching: boolean;
  searchQuery: string;
  onRelinkFolder: (projectId: string) => void;
}) {
  const q = searchQuery.trim().toLowerCase();
  const rows = projectIds
    .map((id) => projectsById.get(id))
    .filter((project): project is Project => project !== undefined);

  if (rows.length === 0) return null;

  return (
    <li className="min-w-0 space-y-1">
      <p
        className="truncate px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
        title={label}
      >
        {label}
      </p>
      <ul className="list-none space-y-1">
        {rows.map((project) => {
          const hasVisibleChunks =
            visibleChunkIds !== undefined &&
            projectProjectHasVisibleChunks(project.id, chunks, visibleChunkIds);
          const expanded = isSearching
            ? project.name.toLowerCase().includes(q) || hasVisibleChunks
            : expandedProjectIds.includes(project.id);
          return (
            <ProjectRow
              key={project.id}
              project={project}
              chunks={chunks}
              activeChunkId={activeChunkId}
              expanded={expanded}
              visibleChunkIds={visibleChunkIds}
              onToggleExpanded={() =>
                useProjectStore.getState().toggleProjectExpanded(project.id)
              }
              onRelinkFolder={() => onRelinkFolder(project.id)}
            />
          );
        })}
      </ul>
    </li>
  );
}

export function ProjectLeftPanel({
  onRequestOpenProject,
  folderPicker = createTauriFolderPicker(),
}: ProjectLeftPanelProps) {
  const projects = useProjectStore((s) => s.projects);
  const chunks = useProjectStore((s) => s.chunks);
  const groups = useProjectStore((s) => s.groups);
  const expandedProjectIds = useProjectStore((s) => s.expandedProjectIds);
  const activeChunkId = useProjectStore((s) => s.activeChunkId);
  const toggleProjectExpanded = useProjectStore((s) => s.toggleProjectExpanded);
  const messagesByChunkId = useChatStore((s) => s.messagesByChunkId);
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();
  const isSearching = q.length > 0;

  const visibleChunkIds = useMemo(() => {
    if (!isSearching) return undefined;
    const titleChunkIds = projectSearchTitleChunkIds(chunks, projects, groups, q);
    const messageChunkIds = useChatStore
      .getState()
      .searchMessages(q)
      .map((hit) => hit.chunkId);
    const hitIds = projectMergeSearchResults({ titleChunkIds, messageChunkIds });
    return projectExpandChunkAncestors(chunks, hitIds);
  }, [isSearching, q, chunks, projects, groups, messagesByChunkId]);

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const sortedProjects = [...projects].sort((a, b) => a.listOrder - b.listOrder);

  const displayedProjects = isSearching
    ? sortedProjects.filter(
        (project) =>
          project.name.toLowerCase().includes(q) ||
          (visibleChunkIds !== undefined &&
            projectProjectHasVisibleChunks(project.id, chunks, visibleChunkIds)),
      )
    : sortedProjects;

  const unpinnedProjects = displayedProjects.filter((project) => !project.pinned);
  const pinnedProjects = displayedProjects.filter((project) => project.pinned);

  const manualGroups = [...groups]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      id: group.id,
      label: group.label,
      projectIds: group.projectIds.filter((id) => {
        const project = projectsById.get(id);
        return project !== undefined && !project.pinned;
      }),
    }))
    .filter((group) => group.projectIds.length > 0);

  const autoGroups = projectBuildAutoGroups(unpinnedProjects).filter(
    (group) => group.projectIds.length > 0,
  );
  const autoGroupedIds = new Set(autoGroups.flatMap((group) => group.projectIds));
  const ungroupedProjectIds = unpinnedProjects
    .filter((project) => !project.manualGroupId && !autoGroupedIds.has(project.id))
    .map((project) => project.id);

  const handleOpenProject = async () => {
    if (onRequestOpenProject) {
      onRequestOpenProject();
      return;
    }
    const path = await folderPicker.pickFolder();
    if (path === null) return;
    projectOpenFolder(path);
  };

  const handleRelinkFolder = async (projectId: string) => {
    const path = await folderPicker.pickFolder();
    if (path === null) return;
    useProjectStore.getState().updateProjectFolder(projectId, path);
    if (useProjectStore.getState().activeProjectId === projectId) {
      useWorkspaceStore.getState().setWorkspace(path);
    }
  };

  const renderProjectRow = (project: Project) => {
    const hasVisibleChunks =
      visibleChunkIds !== undefined &&
      projectProjectHasVisibleChunks(project.id, chunks, visibleChunkIds);
    const expanded = isSearching
      ? project.name.toLowerCase().includes(q) || hasVisibleChunks
      : expandedProjectIds.includes(project.id);
    return (
      <ProjectRow
        key={project.id}
        project={project}
        chunks={chunks}
        activeChunkId={activeChunkId}
        expanded={expanded}
        visibleChunkIds={visibleChunkIds}
        onToggleExpanded={() => toggleProjectExpanded(project.id)}
        onRelinkFolder={() => void handleRelinkFolder(project.id)}
      />
    );
  };

  return (
    <TooltipProvider delay={200}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Projects
      </p>
      <div className="border-b border-border px-3 py-2">
        <input
          type="search"
          aria-label="Search projects"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search"
          className="w-full border border-border bg-background px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-2">
        {projects.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            className="w-full font-mono text-[11px] uppercase tracking-[0.08em]"
            onClick={() => void handleOpenProject()}
          >
            Open project
          </Button>
        ) : isSearching ? (
          <ul className="list-none space-y-1">{displayedProjects.map(renderProjectRow)}</ul>
        ) : (
          <ul className="list-none space-y-2">
            {pinnedProjects.length > 0 ? (
              <ProjectSection
                label="Pinned"
                projectIds={pinnedProjects.map((p) => p.id)}
                projectsById={projectsById}
                chunks={chunks}
                activeChunkId={activeChunkId}
                expandedProjectIds={expandedProjectIds}
                visibleChunkIds={visibleChunkIds}
                isSearching={isSearching}
                searchQuery={searchQuery}
                onRelinkFolder={(projectId) => void handleRelinkFolder(projectId)}
              />
            ) : null}
            {manualGroups.map((group) => (
              <ProjectSection
                key={group.id}
                label={group.label}
                projectIds={group.projectIds}
                projectsById={projectsById}
                chunks={chunks}
                activeChunkId={activeChunkId}
                expandedProjectIds={expandedProjectIds}
                visibleChunkIds={visibleChunkIds}
                isSearching={isSearching}
                searchQuery={searchQuery}
                onRelinkFolder={(projectId) => void handleRelinkFolder(projectId)}
              />
            ))}
            {autoGroups.map((group) => (
              <ProjectSection
                key={group.key}
                label={group.label}
                projectIds={group.projectIds}
                projectsById={projectsById}
                chunks={chunks}
                activeChunkId={activeChunkId}
                expandedProjectIds={expandedProjectIds}
                visibleChunkIds={visibleChunkIds}
                isSearching={isSearching}
                searchQuery={searchQuery}
                onRelinkFolder={(projectId) => void handleRelinkFolder(projectId)}
              />
            ))}
            {ungroupedProjectIds.length > 0 ? (
              <ProjectSection
                label="Ungrouped"
                projectIds={ungroupedProjectIds}
                projectsById={projectsById}
                chunks={chunks}
                activeChunkId={activeChunkId}
                expandedProjectIds={expandedProjectIds}
                visibleChunkIds={visibleChunkIds}
                isSearching={isSearching}
                searchQuery={searchQuery}
                onRelinkFolder={(projectId) => void handleRelinkFolder(projectId)}
              />
            ) : null}
          </ul>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
