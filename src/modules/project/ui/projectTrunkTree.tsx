import { Pin, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { projectFlattenTrunks, projectListChildTrunks } from "../domain/projectTrunkTree";
import type { ProjectTrunk } from "../domain/projectTypes";
import { projectActivateTrunk } from "../state/projectActivation";
import { useProjectStore } from "../state/projectStore";
import { PanelToolButton } from "./panelToolButton";
import { PanelTooltip } from "./panelTooltip";

export interface ProjectTrunkTreeProps {
  projectId: string;
  trunks: readonly ProjectTrunk[];
  activeTrunkId: string | null;
  visibleTrunkIds?: ReadonlySet<string>;
}

const DELETE_TRUNK_CONFIRM = "Delete this trunk?";
const TRUNK_DRAG_ID_MIME = "application/x-project-trunk-id";
const TRUNK_DRAG_PARENT_MIME = "application/x-project-trunk-parent-id";

function reorderTrunkSiblings(
  trunks: readonly ProjectTrunk[],
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) return;
  const siblings = projectListChildTrunks(trunks, null);
  const ids = siblings.map((trunk) => trunk.id);
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const reordered = [...ids];
  reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, sourceId);
  useProjectStore.getState().reorderSiblingTrunks(null, reordered);
}

interface TrunkRowProps {
  trunk: ProjectTrunk;
  trunks: readonly ProjectTrunk[];
  activeTrunkId: string | null;
}

function TrunkRow({ trunk, trunks, activeTrunkId }: TrunkRowProps) {
  return (
    <li className="min-w-0">
      <div className="flex min-w-0 w-full items-center gap-0.5 px-2">
        <PanelTooltip label={trunk.title}>
          <button
            type="button"
            draggable
            aria-current={activeTrunkId === trunk.id ? "true" : undefined}
            className={cn(
              "min-w-0 flex-1 overflow-hidden rounded-sm px-2 py-1 text-left font-mono text-[11px] tracking-[0.08em]",
              activeTrunkId === trunk.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            onClick={() => projectActivateTrunk(trunk.id)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(TRUNK_DRAG_ID_MIME, trunk.id);
              event.dataTransfer.setData(TRUNK_DRAG_PARENT_MIME, "");
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData(TRUNK_DRAG_ID_MIME);
              reorderTrunkSiblings(trunks, sourceId, trunk.id);
            }}
          >
            <span className="block truncate">{trunk.title}</span>
          </button>
        </PanelTooltip>
        <PanelToolButton
          label={
            trunk.pinned ? `Unpin trunk ${trunk.title}` : `Pin trunk ${trunk.title}`
          }
          onClick={(event) => {
            event.stopPropagation();
            useProjectStore.getState().setTrunkPinned(trunk.id, !trunk.pinned);
          }}
        >
          <Pin className="size-3" aria-hidden />
        </PanelToolButton>
        <PanelToolButton
          label={`Delete trunk ${trunk.title}`}
          onClick={(event) => {
            event.stopPropagation();
            if (!window.confirm(DELETE_TRUNK_CONFIRM)) return;
            useProjectStore.getState().deleteTrunkCascade(trunk.id);
          }}
        >
          <Trash2 className="size-3" aria-hidden />
        </PanelToolButton>
      </div>
    </li>
  );
}

export function ProjectTrunkTree({
  projectId,
  trunks,
  activeTrunkId,
  visibleTrunkIds,
}: ProjectTrunkTreeProps) {
  const projectTrunks = projectFlattenTrunks(
    trunks.filter((trunk) => trunk.projectId === projectId),
  );
  const rows = projectListChildTrunks(projectTrunks, null).filter(
    (trunk) => !visibleTrunkIds || visibleTrunkIds.has(trunk.id),
  );

  return (
    <ul className="list-none">
      {rows.map((trunk) => (
        <TrunkRow
          key={trunk.id}
          trunk={trunk}
          trunks={projectTrunks}
          activeTrunkId={activeTrunkId}
        />
      ))}
    </ul>
  );
}
