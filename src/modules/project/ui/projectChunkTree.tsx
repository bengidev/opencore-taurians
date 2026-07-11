import { Pin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { projectListChildChunks } from "../domain/projectChunkTree";
import type { ProjectChunk } from "../domain/projectTypes";
import { projectActivateChunk } from "../state/projectActivation";
import { useProjectStore } from "../state/projectStore";

export interface ProjectChunkTreeProps {
  projectId: string;
  chunks: readonly ProjectChunk[];
  activeChunkId: string | null;
  visibleChunkIds?: ReadonlySet<string>;
}

const NEW_CHUNK_TITLE = "New chunk";
const DELETE_CONFIRM = "Delete this chunk and its children?";
const CHUNK_DRAG_ID_MIME = "application/x-project-chunk-id";
const CHUNK_DRAG_PARENT_MIME = "application/x-project-chunk-parent-id";

function reorderChunkSiblings(
  chunks: readonly ProjectChunk[],
  parentChunkId: string | null,
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) return;
  const siblings = projectListChildChunks(chunks, parentChunkId);
  const ids = siblings.map((chunk) => chunk.id);
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const reordered = [...ids];
  reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, sourceId);
  useProjectStore.getState().reorderSiblingChunks(parentChunkId, reordered);
}

interface ChunkNodesProps {
  chunks: readonly ProjectChunk[];
  parentChunkId: string | null;
  activeChunkId: string | null;
  depth: number;
  visibleChunkIds?: ReadonlySet<string>;
}

function ChunkNodes({
  chunks,
  parentChunkId,
  activeChunkId,
  depth,
  visibleChunkIds,
}: ChunkNodesProps) {
  const nodes = projectListChildChunks(chunks, parentChunkId).filter(
    (chunk) => !visibleChunkIds || visibleChunkIds.has(chunk.id),
  );

  return (
    <>
      {nodes.map((chunk) => (
        <li key={chunk.id} className="min-w-0">
          <div
            className="flex min-w-0 w-full items-center gap-0.5"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <button
              type="button"
              draggable
              aria-current={activeChunkId === chunk.id ? "true" : undefined}
              title={chunk.title}
              className={cn(
                "min-w-0 flex-1 overflow-hidden rounded-sm px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.08em]",
                activeChunkId === chunk.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              onClick={() => projectActivateChunk(chunk.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(CHUNK_DRAG_ID_MIME, chunk.id);
                event.dataTransfer.setData(
                  CHUNK_DRAG_PARENT_MIME,
                  chunk.parentChunkId ?? "",
                );
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData(CHUNK_DRAG_ID_MIME);
                const sourceParentRaw = event.dataTransfer.getData(CHUNK_DRAG_PARENT_MIME);
                const sourceParentId = sourceParentRaw === "" ? null : sourceParentRaw;
                if (sourceParentId !== chunk.parentChunkId) return;
                reorderChunkSiblings(chunks, chunk.parentChunkId, sourceId, chunk.id);
              }}
            >
              <span className="block truncate">{chunk.title}</span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={
                chunk.pinned ? `Unpin chunk ${chunk.title}` : `Pin chunk ${chunk.title}`
              }
              className="shrink-0 text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                useProjectStore.getState().setChunkPinned(chunk.id, !chunk.pinned);
              }}
            >
              <Pin className="size-3" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Add child chunk"
              className="shrink-0 text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                const child = useProjectStore.getState().addChildChunk({
                  parentChunkId: chunk.id,
                  title: NEW_CHUNK_TITLE,
                  nowIso: new Date().toISOString(),
                });
                if (child) projectActivateChunk(child.id);
              }}
            >
              <Plus className="size-3" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete chunk ${chunk.title}`}
              className="shrink-0 text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                if (!window.confirm(DELETE_CONFIRM)) return;
                useProjectStore.getState().deleteChunkCascade(chunk.id);
              }}
            >
              <Trash2 className="size-3" aria-hidden />
            </Button>
          </div>
          <ul className="list-none">
            <ChunkNodes
              chunks={chunks}
              parentChunkId={chunk.id}
              activeChunkId={activeChunkId}
              depth={depth + 1}
              visibleChunkIds={visibleChunkIds}
            />
          </ul>
        </li>
      ))}
    </>
  );
}

export function ProjectChunkTree({
  projectId,
  chunks,
  activeChunkId,
  visibleChunkIds,
}: ProjectChunkTreeProps) {
  const projectChunks = chunks.filter((chunk) => chunk.projectId === projectId);

  return (
    <ul className="list-none">
      <ChunkNodes
        chunks={projectChunks}
        parentChunkId={null}
        activeChunkId={activeChunkId}
        depth={0}
        visibleChunkIds={visibleChunkIds}
      />
    </ul>
  );
}
