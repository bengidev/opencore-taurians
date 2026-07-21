import { useState } from "react";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { projectFlattenTrunks, projectListChildTrunks } from "../domain/projectTrunkTree";
import type { ProjectTrunk } from "../domain/projectTypes";
import { projectActivateTrunk } from "../state/projectActivation";
import { useProjectStore } from "../state/projectStore";
import { ProjectTrunkRenameInput } from "./projectTrunkRenameInput";

export interface ProjectTrunkTreeProps {
  projectId: string;
  trunks: readonly ProjectTrunk[];
  activeTrunkId: string | null;
  visibleTrunkIds?: ReadonlySet<string>;
}

const DELETE_TRUNK_CONFIRM = "Delete this trunk?";
const TRUNK_DRAG_ID_MIME = "application/x-project-trunk-id";
const TRUNK_DRAG_PARENT_MIME = "application/x-project-trunk-parent-id";
const trunkContextMenuClassName =
  "min-w-36 font-mono text-xs tracking-[0.08em]";

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
  reordered.splice(targetIndex, 0, targetId);
  useProjectStore.getState().reorderSiblingTrunks(null, reordered);
}

interface TrunkRowProps {
  trunk: ProjectTrunk;
  trunks: readonly ProjectTrunk[];
  activeTrunkId: string | null;
  renaming: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
}

function TrunkRow({
  trunk,
  trunks,
  activeTrunkId,
  renaming,
  onStartRename,
  onCancelRename,
}: TrunkRowProps) {
  const renameTrunk = useProjectStore((s) => s.renameTrunk);

  if (renaming) {
    return (
      <li className="min-w-0 px-2 py-0.5">
        <ProjectTrunkRenameInput
          initialTitle={trunk.title}
          onCommit={(title) => {
            renameTrunk(trunk.id, title);
            onCancelRename();
          }}
          onCancel={onCancelRename}
        />
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <ContextMenu>
        <div
          className="flex min-w-0 w-full items-center gap-0.5 px-2"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData(TRUNK_DRAG_ID_MIME);
            reorderTrunkSiblings(trunks, sourceId, trunk.id);
          }}
        >
          <ContextMenuTrigger
            render={
              <button
                type="button"
                draggable
                title={trunk.title}
                aria-current={activeTrunkId === trunk.id ? "true" : undefined}
                className={cn(
                  "min-w-0 flex-1 overflow-hidden rounded-sm px-2 py-1 text-left font-mono text-[11px] tracking-[0.08em]",
                  activeTrunkId === trunk.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              />
            }
            onClick={() => projectActivateTrunk(trunk.id)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(TRUNK_DRAG_ID_MIME, trunk.id);
              event.dataTransfer.setData(TRUNK_DRAG_PARENT_MIME, "");
            }}
          >
            <span className="block truncate">{trunk.title}</span>
          </ContextMenuTrigger>
        </div>
        <ContextMenuContent className={trunkContextMenuClassName}>
          <ContextMenuItem onClick={onStartRename}>
            <Pencil className="size-3.5" aria-hidden />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() =>
              useProjectStore.getState().setTrunkPinned(trunk.id, !trunk.pinned)
            }
          >
            {trunk.pinned ? (
              <PinOff className="size-3.5" aria-hidden />
            ) : (
              <Pin className="size-3.5" aria-hidden />
            )}
            {trunk.pinned ? "Unpin" : "Pin"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              if (!window.confirm(DELETE_TRUNK_CONFIRM)) return;
              useProjectStore.getState().deleteTrunkCascade(trunk.id);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
}

export function ProjectTrunkTree({
  projectId,
  trunks,
  activeTrunkId,
  visibleTrunkIds,
}: ProjectTrunkTreeProps) {
  const [renamingTrunkId, setRenamingTrunkId] = useState<string | null>(null);
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
          renaming={renamingTrunkId === trunk.id}
          onStartRename={() => setRenamingTrunkId(trunk.id)}
          onCancelRename={() => setRenamingTrunkId(null)}
        />
      ))}
    </ul>
  );
}
