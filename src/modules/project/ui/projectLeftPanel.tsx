import {
  ChevronDown,
  ChevronRight,
  FolderInput,
  FolderOpen,
  FolderSync,
  FolderX,
  Pin,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { projectActivateTrunk } from "../state/projectActivation";
import { projectRequestOpenFolder } from "./projectAddButton";
import { useProjectStore } from "../state/projectStore";
import { PanelToolButton } from "./panelToolButton";
import { ProjectAddButton } from "./projectAddButton";
import { PanelTooltip } from "./panelTooltip";
import { ProjectTrunkTree } from "./projectTrunkTree";
import {
  projectExpandTrunkAncestors,
  projectProjectHasVisibleTrunks,
  projectSearchTitleTrunkIds,
} from "./projectPanelSearch";

const NEW_TRUNK_TITLE = "New trunk";
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
  trunks,
  activeTrunkId,
  expanded,
  visibleTrunkIds,
  onToggleExpanded,
  onRelinkFolder,
}: {
  project: Project;
  trunks: ReturnType<typeof useProjectStore.getState>["trunks"];
  activeTrunkId: string | null;
  expanded: boolean;
  visibleTrunkIds: Set<string> | undefined;
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
          label="Add root trunk"
          onClick={(event) => {
            event.stopPropagation();
            const trunk = useProjectStore.getState().addRootTrunk({
              projectId: project.id,
              title: NEW_TRUNK_TITLE,
              nowIso: new Date().toISOString(),
            });
            if (trunk) projectActivateTrunk(trunk.id);
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
        <ProjectTrunkTree
          projectId={project.id}
          trunks={trunks}
          activeTrunkId={activeTrunkId}
          visibleTrunkIds={visibleTrunkIds}
        />
      ) : null}
    </li>
  );
}

function ProjectSection({
  label,
  projectIds,
  projectsById,
  trunks,
  activeTrunkId,
  expandedProjectIds,
  visibleTrunkIds,
  isSearching,
  searchQuery,
  onRelinkFolder,
}: {
  label: string;
  projectIds: string[];
  projectsById: Map<string, Project>;
  trunks: ReturnType<typeof useProjectStore.getState>["trunks"];
  activeTrunkId: string | null;
  expandedProjectIds: string[];
  visibleTrunkIds: Set<string> | undefined;
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
          const hasVisibleTrunks =
            visibleTrunkIds !== undefined &&
            projectProjectHasVisibleTrunks(project.id, trunks, visibleTrunkIds);
          const expanded = isSearching
            ? project.name.toLowerCase().includes(q) || hasVisibleTrunks
            : expandedProjectIds.includes(project.id);
          return (
            <ProjectRow
              key={project.id}
              project={project}
              trunks={trunks}
              activeTrunkId={activeTrunkId}
              expanded={expanded}
              visibleTrunkIds={visibleTrunkIds}
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
  const trunks = useProjectStore((s) => s.trunks);
  const groups = useProjectStore((s) => s.groups);
  const expandedProjectIds = useProjectStore((s) => s.expandedProjectIds);
  const activeTrunkId = useProjectStore((s) => s.activeTrunkId);
  const toggleProjectExpanded = useProjectStore((s) => s.toggleProjectExpanded);
  const messagesByTrunkId = useChatStore((s) => s.messagesByTrunkId);
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.trim().toLowerCase();
  const isSearching = q.length > 0;

  const visibleTrunkIds = useMemo(() => {
    if (!isSearching) return undefined;
    const titleTrunkIds = projectSearchTitleTrunkIds(trunks, projects, groups, q);
    const messageTrunkIds = useChatStore
      .getState()
      .searchMessages(q)
      .map((hit) => hit.trunkId);
    const hitIds = projectMergeSearchResults({ titleTrunkIds, messageTrunkIds });
    return projectExpandTrunkAncestors(trunks, hitIds);
  }, [isSearching, q, trunks, projects, groups, messagesByTrunkId]);

  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const sortedProjects = [...projects].sort((a, b) => a.listOrder - b.listOrder);

  const displayedProjects = isSearching
    ? sortedProjects.filter(
        (project) =>
          project.name.toLowerCase().includes(q) ||
          (visibleTrunkIds !== undefined &&
            projectProjectHasVisibleTrunks(project.id, trunks, visibleTrunkIds)),
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

  const handleOpenProject = () =>
    projectRequestOpenFolder({ onRequestOpenProject, folderPicker });

  const handleRelinkFolder = async (projectId: string) => {
    const path = await folderPicker.pickFolder();
    if (path === null) return;
    useProjectStore.getState().updateProjectFolder(projectId, path);
    if (useProjectStore.getState().activeProjectId === projectId) {
      useWorkspaceStore.getState().setWorkspace(path);
    }
  };

  const renderProjectRow = (project: Project) => {
    const hasVisibleTrunks =
      visibleTrunkIds !== undefined &&
      projectProjectHasVisibleTrunks(project.id, trunks, visibleTrunkIds);
    const expanded = isSearching
      ? project.name.toLowerCase().includes(q) || hasVisibleTrunks
      : expandedProjectIds.includes(project.id);
    return (
      <ProjectRow
        key={project.id}
        project={project}
        trunks={trunks}
        activeTrunkId={activeTrunkId}
        expanded={expanded}
        visibleTrunkIds={visibleTrunkIds}
        onToggleExpanded={() => toggleProjectExpanded(project.id)}
        onRelinkFolder={() => void handleRelinkFolder(project.id)}
      />
    );
  };

  return (
    <TooltipProvider delay={200}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1">
        <p className="px-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Projects
        </p>
        {projects.length > 0 ? (
          <ProjectAddButton
            onRequestOpenProject={onRequestOpenProject}
            folderPicker={folderPicker}
          />
        ) : null}
      </div>
      {projects.length > 0 ? (
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
      ) : null}
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-2">
        {projects.length === 0 ? (
          <Empty className="min-h-40 gap-ds-6 border-2 border-dashed border-[color:var(--ds-border-strong)] bg-background p-ds-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpen aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>
                Open a folder to add your first project.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                size="sm"
                className="font-mono text-[11px] uppercase tracking-[0.08em]"
                onClick={() => void handleOpenProject()}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Open project
              </Button>
            </EmptyContent>
          </Empty>
        ) : isSearching ? (
          <ul className="list-none space-y-1">{displayedProjects.map(renderProjectRow)}</ul>
        ) : (
          <ul className="list-none space-y-2">
            {pinnedProjects.length > 0 ? (
              <ProjectSection
                label="Pinned"
                projectIds={pinnedProjects.map((p) => p.id)}
                projectsById={projectsById}
                trunks={trunks}
                activeTrunkId={activeTrunkId}
                expandedProjectIds={expandedProjectIds}
                visibleTrunkIds={visibleTrunkIds}
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
                trunks={trunks}
                activeTrunkId={activeTrunkId}
                expandedProjectIds={expandedProjectIds}
                visibleTrunkIds={visibleTrunkIds}
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
                trunks={trunks}
                activeTrunkId={activeTrunkId}
                expandedProjectIds={expandedProjectIds}
                visibleTrunkIds={visibleTrunkIds}
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
                trunks={trunks}
                activeTrunkId={activeTrunkId}
                expandedProjectIds={expandedProjectIds}
                visibleTrunkIds={visibleTrunkIds}
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
