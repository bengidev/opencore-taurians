import { describe, expect, it } from "vitest";
import {
  projectCollectSubtreeChunkIds,
  projectListChildChunks,
  projectReorderSiblingChunks,
} from "./projectChunkTree";
import type { ProjectChunk } from "./projectTypes";

function chunk(
  partial: Pick<ProjectChunk, "id" | "projectId" | "parentChunkId" | "title"> &
    Partial<ProjectChunk>,
): ProjectChunk {
  return {
    pinned: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
    ...partial,
  };
}

describe("projectChunkTree", () => {
  const chunks: ProjectChunk[] = [
    chunk({ id: "r", projectId: "p", parentChunkId: null, title: "root", siblingOrder: 0 }),
    chunk({ id: "a", projectId: "p", parentChunkId: "r", title: "a", siblingOrder: 0 }),
    chunk({ id: "b", projectId: "p", parentChunkId: "r", title: "b", siblingOrder: 1 }),
    chunk({ id: "a1", projectId: "p", parentChunkId: "a", title: "a1", siblingOrder: 0 }),
  ];

  it("lists children sorted by siblingOrder", () => {
    expect(projectListChildChunks(chunks, "r").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("collects subtree ids including root", () => {
    expect(projectCollectSubtreeChunkIds(chunks, "a").sort()).toEqual(["a", "a1"]);
  });

  it("reorders siblings under the same parent", () => {
    const next = projectReorderSiblingChunks(chunks, "r", ["b", "a"]);
    expect(projectListChildChunks(next, "r").map((c) => c.id)).toEqual(["b", "a"]);
  });
});
