import { Pin, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { projectIsRootTrunk, projectListChildTrunks } from "../domain/projectTrunkTree";
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

const NEW_TRUNK_TITLE = "New trunk";
const DELETE_ROOT_CONFIRM = "Delete this trunk and its children?";
const DELETE_CHILD_CONFIRM = "Delete this trunk?";
const TRUNK_DRAG_ID_MIME = "application/x-project-trunk-id";
const TRUNK_DRAG_PARENT_MIME = "application/x-project-trunk-parent-id";

function reorderTrunkSiblings(
  trunks: readonly ProjectTrunk[],
  parentTrunkId: string | null,
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) return;
  const siblings = projectListChildTrunks(trunks, parentTrunkId);
  const ids = siblings.map((trunk) => trunk.id);
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const reordered = [...ids];
  reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, sourceId);
  useProjectStore.getState().reorderSiblingTrunks(parentTrunkId, reordered);
}

interface TrunkRowProps {
  trunk: ProjectTrunk;
  trunks: readonly ProjectTrunk[];
  activeTrunkId: string | null;
  depth: number;
}

function TrunkRow({ trunk, trunks, activeTrunkId, depth }: TrunkRowProps) {
  const isRoot = projectIsRootTrunk(trunk);

  return (
    <li className="min-w-0">
      <div
        className="flex min-w-0 w-full items-center gap-0.5"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <PanelTooltip label={trunk.title}>
          <button
            type="button"
            draggable
            aria-current={activeTrunkId === trunk.id ? "true" : undefined}
            className={cn(
              "min-w-0 flex-1 overflow-hidden rounded-sm px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.08em]",
              activeTrunkId === trunk.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            onClick={() => projectActivateTrunk(trunk.id)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(TRUNK_DRAG_ID_MIME, trunk.id);
              event.dataTransfer.setData(
                TRUNK_DRAG_PARENT_MIME,
                trunk.parentTrunkId ?? "",
              );
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData(TRUNK_DRAG_ID_MIME);
              const sourceParentRaw = event.dataTransfer.getData(TRUNK_DRAG_PARENT_MIME);
              const sourceParentId = sourceParentRaw === "" ? null : sourceParentRaw;
              if (sourceParentId !== trunk.parentTrunkId) return;
              reorderTrunkSiblings(trunks, trunk.parentTrunkId, sourceId, trunk.id);
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
        {isRoot ? (
          <PanelToolButton
            label="Add child trunk"
            onClick={(event) => {
              event.stopPropagation();
              const child = useProjectStore.getState().addChildTrunk({
                parentTrunkId: trunk.id,
                title: NEW_TRUNK_TITLE,
                nowIso: new Date().toISOString(),
              });
              if (child) projectActivateTrunk(child.id);
            }}
          >
            <Plus className="size-3" aria-hidden />
          </PanelToolButton>
        ) : null}
        <PanelToolButton
          label={`Delete trunk ${trunk.title}`}
          onClick={(event) => {
            event.stopPropagation();
            const confirmMessage = isRoot ? DELETE_ROOT_CONFIRM : DELETE_CHILD_CONFIRM;
            if (!window.confirm(confirmMessage)) return;
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
  const projectTrunks = trunks.filter((trunk) => trunk.projectId === projectId);
  const roots = projectListChildTrunks(projectTrunks, null).filter(
    (trunk) => !visibleTrunkIds || visibleTrunkIds.has(trunk.id),
  );

  return (
    <ul className="list-none">
      {roots.flatMap((root) => {
        const children = projectListChildTrunks(projectTrunks, root.id).filter(
          (trunk) => !visibleTrunkIds || visibleTrunkIds.has(trunk.id),
        );
        return [
          <TrunkRow
            key={root.id}
            trunk={root}
            trunks={projectTrunks}
            activeTrunkId={activeTrunkId}
            depth={0}
          />,
          ...children.map((child) => (
            <TrunkRow
              key={child.id}
              trunk={child}
              trunks={projectTrunks}
              activeTrunkId={activeTrunkId}
              depth={1}
            />
          )),
        ];
      })}
    </ul>
  );
}
