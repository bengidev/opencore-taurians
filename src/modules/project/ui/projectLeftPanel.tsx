import { ChevronDown, ChevronRight, FolderSync, Pin, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createTauriFolderPicker,
  type FolderPicker,
} from "../../workspace-popup/infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";
import { projectActivateChunk } from "../state/projectActivation";
import { useProjectStore } from "../state/projectStore";
import { ProjectChunkTree } from "./projectChunkTree";

const NEW_CHUNK_TITLE = "New chunk";

export interface ProjectLeftPanelProps {
  onRequestOpenProject?: () => void;
  folderPicker?: FolderPicker;
}

export function ProjectLeftPanel({
  onRequestOpenProject,
  folderPicker = createTauriFolderPicker(),
}: ProjectLeftPanelProps) {
  const projects = useProjectStore((s) => s.projects);
  const chunks = useProjectStore((s) => s.chunks);
  const expandedProjectIds = useProjectStore((s) => s.expandedProjectIds);
  const activeChunkId = useProjectStore((s) => s.activeChunkId);
  const toggleProjectExpanded = useProjectStore((s) => s.toggleProjectExpanded);
  const [searchQuery, setSearchQuery] = useState("");

  const sortedProjects = [...projects].sort((a, b) => a.listOrder - b.listOrder);

  const handleRelinkFolder = async (projectId: string) => {
    const path = await folderPicker.pickFolder();
    if (path === null) return;
    useProjectStore.getState().updateProjectFolder(projectId, path);
    if (useProjectStore.getState().activeProjectId === projectId) {
      useWorkspaceStore.getState().setWorkspace(path);
    }
  };

  return (
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
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {projects.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            className="w-full font-mono text-[11px] uppercase tracking-[0.08em]"
            onClick={onRequestOpenProject}
          >
            Open project
          </Button>
        ) : (
          <ul className="list-none space-y-1">
            {sortedProjects.map((project) => {
              const expanded = expandedProjectIds.includes(project.id);
              return (
                <li key={project.id}>
                  <div className="flex w-full items-center gap-0.5">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-1 rounded-sm px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-foreground hover:bg-muted/60",
                      )}
                      onClick={() => toggleProjectExpanded(project.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="size-3 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRight className="size-3 shrink-0" aria-hidden />
                      )}
                      {project.name}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={
                        project.pinned
                          ? `Unpin project ${project.name}`
                          : `Pin project ${project.name}`
                      }
                      className="shrink-0 text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        useProjectStore
                          .getState()
                          .setProjectPinned(project.id, !project.pinned);
                      }}
                    >
                      <Pin className="size-3" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Add root chunk"
                      className="shrink-0 text-muted-foreground"
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
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Relink folder"
                      className="shrink-0 text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRelinkFolder(project.id);
                      }}
                    >
                      <FolderSync className="size-3" aria-hidden />
                    </Button>
                  </div>
                  {expanded ? (
                    <ProjectChunkTree
                      projectId={project.id}
                      chunks={chunks}
                      activeChunkId={activeChunkId}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
