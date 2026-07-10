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
  const nodes = projectListChildChunks(chunks, parentChunkId);

  return (
    <>
      {nodes.flatMap((chunk) => {
        const descendants = (
          <ChunkNodes
            chunks={chunks}
            parentChunkId={chunk.id}
            activeChunkId={activeChunkId}
            depth={depth + 1}
            visibleChunkIds={visibleChunkIds}
          />
        );
        if (visibleChunkIds && !visibleChunkIds.has(chunk.id)) {
          return descendants;
        }
        return (
          <li key={chunk.id}>
            <div
              className="flex w-full items-center gap-0.5"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <button
                type="button"
                aria-current={activeChunkId === chunk.id ? "true" : undefined}
                className={cn(
                  "min-w-0 flex-1 rounded-sm px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.08em]",
                  activeChunkId === chunk.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                onClick={() => projectActivateChunk(chunk.id)}
              >
                {chunk.title}
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
            <ul className="list-none">{descendants}</ul>
          </li>
        );
      })}
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
