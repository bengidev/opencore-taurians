import { describe, expect, it } from "vitest";
import { projectSelectExpired } from "./projectRetention";
import type { Project, ProjectChunk } from "./projectTypes";

const NOW = Date.parse("2026-07-10T00:00:00.000Z");
const OLD = "2026-05-01T00:00:00.000Z";
const RECENT = "2026-07-01T00:00:00.000Z";

function p(partial: Partial<Project> & Pick<Project, "id">): Project {
  return {
    name: partial.id,
    folderPath: `/p/${partial.id}`,
    pinned: false,
    createdAt: OLD,
    lastOpenedAt: OLD,
    listOrder: 0,
    ...partial,
  };
}

function c(
  partial: Partial<ProjectChunk> & Pick<ProjectChunk, "id" | "projectId">,
): ProjectChunk {
  return {
    parentChunkId: null,
    title: partial.id,
    pinned: false,
    createdAt: OLD,
    lastOpenedAt: OLD,
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
    ...partial,
  };
}

describe("projectSelectExpired", () => {
  it("expires unpinned stale chunks and projects without pinned chunks", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "stale" }), p({ id: "fresh", lastOpenedAt: RECENT })],
      chunks: [
        c({ id: "c-stale", projectId: "stale", lastOpenedAt: OLD }),
        c({ id: "c-fresh", projectId: "fresh", lastOpenedAt: RECENT }),
      ],
    });
    expect(result.chunkIds.sort()).toEqual(["c-stale"]);
    expect(result.projectIds.sort()).toEqual(["stale"]);
  });

  it("keeps pinned chunk and its ancestor project", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "p1" })],
      chunks: [
        c({ id: "root", projectId: "p1", lastOpenedAt: OLD }),
        c({
          id: "pin",
          projectId: "p1",
          parentChunkId: "root",
          pinned: true,
          lastOpenedAt: OLD,
        }),
      ],
    });
    expect(result.chunkIds).toEqual([]);
    expect(result.projectIds).toEqual([]);
  });

  it("keeps pinned projects even when stale", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "p1", pinned: true })],
      chunks: [c({ id: "c1", projectId: "p1", lastOpenedAt: OLD })],
    });
    expect(result.projectIds).toEqual([]);
    expect(result.chunkIds).toEqual([]);
  });
});
