import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjectStore } from "../state/projectStore";
import { ProjectChunkTree } from "./projectChunkTree";

export interface ProjectLeftPanelProps {
  onRequestOpenProject?: () => void;
}

export function ProjectLeftPanel({ onRequestOpenProject }: ProjectLeftPanelProps) {
  const projects = useProjectStore((s) => s.projects);
  const chunks = useProjectStore((s) => s.chunks);
  const expandedProjectIds = useProjectStore((s) => s.expandedProjectIds);
  const activeChunkId = useProjectStore((s) => s.activeChunkId);
  const toggleProjectExpanded = useProjectStore((s) => s.toggleProjectExpanded);
  const [searchQuery, setSearchQuery] = useState("");

  const sortedProjects = [...projects].sort((a, b) => a.listOrder - b.listOrder);

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
                  <button
                    type="button"
                    aria-expanded={expanded}
                    className={cn(
                      "flex w-full items-center gap-1 rounded-sm px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-foreground hover:bg-muted/60",
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
