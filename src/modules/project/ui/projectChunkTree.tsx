import { cn } from "@/lib/utils";
import { projectListChildChunks } from "../domain/projectChunkTree";
import type { ProjectChunk } from "../domain/projectTypes";
import { projectActivateChunk } from "../state/projectActivation";

export interface ProjectChunkTreeProps {
  projectId: string;
  chunks: readonly ProjectChunk[];
  activeChunkId: string | null;
}

interface ChunkNodesProps {
  chunks: readonly ProjectChunk[];
  parentChunkId: string | null;
  activeChunkId: string | null;
  depth: number;
}

function ChunkNodes({ chunks, parentChunkId, activeChunkId, depth }: ChunkNodesProps) {
  const nodes = projectListChildChunks(chunks, parentChunkId);

  return (
    <>
      {nodes.map((chunk) => (
        <li key={chunk.id}>
          <button
            type="button"
            aria-current={activeChunkId === chunk.id ? "true" : undefined}
            className={cn(
              "flex w-full items-center gap-1 rounded-sm px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.08em]",
              activeChunkId === chunk.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => projectActivateChunk(chunk.id)}
          >
            {chunk.title}
          </button>
          <ul className="list-none">
            <ChunkNodes
              chunks={chunks}
              parentChunkId={chunk.id}
              activeChunkId={activeChunkId}
              depth={depth + 1}
            />
          </ul>
        </li>
      ))}
    </>
  );
}

export function ProjectChunkTree({ projectId, chunks, activeChunkId }: ProjectChunkTreeProps) {
  const projectChunks = chunks.filter((chunk) => chunk.projectId === projectId);

  return (
    <ul className="list-none">
      <ChunkNodes
        chunks={projectChunks}
        parentChunkId={null}
        activeChunkId={activeChunkId}
        depth={0}
      />
    </ul>
  );
}
