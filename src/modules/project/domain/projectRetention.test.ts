import { describe, expect, it } from "vitest";
import { projectSelectExpired } from "./projectRetention";
import type { Project, ProjectTrunk } from "./projectTypes";

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
  partial: Partial<ProjectTrunk> & Pick<ProjectTrunk, "id" | "projectId">,
): ProjectTrunk {
  return {
    parentTrunkId: null,
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
  it("expires unpinned stale trunks and projects without pinned trunks", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "stale" }), p({ id: "fresh", lastOpenedAt: RECENT })],
      trunks: [
        c({ id: "c-stale", projectId: "stale", lastOpenedAt: OLD }),
        c({ id: "c-fresh", projectId: "fresh", lastOpenedAt: RECENT }),
      ],
    });
    expect(result.trunkIds.sort()).toEqual(["c-stale"]);
    expect(result.projectIds.sort()).toEqual(["stale"]);
  });

  it("keeps pinned trunk and its ancestor project", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "p1" })],
      trunks: [
        c({ id: "root", projectId: "p1", lastOpenedAt: OLD }),
        c({
          id: "pin",
          projectId: "p1",
          parentTrunkId: "root",
          pinned: true,
          lastOpenedAt: OLD,
        }),
      ],
    });
    expect(result.trunkIds).toEqual([]);
    expect(result.projectIds).toEqual([]);
  });

  it("keeps pinned projects even when stale", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "p1", pinned: true })],
      trunks: [c({ id: "c1", projectId: "p1", lastOpenedAt: OLD })],
    });
    expect(result.projectIds).toEqual([]);
    expect(result.trunkIds).toEqual([]);
  });

  it("does not expire a stale ancestor when a descendant was used recently", () => {
    const result = projectSelectExpired({
      nowMs: NOW,
      retentionDays: 30,
      projects: [p({ id: "p1" })],
      trunks: [
        c({ id: "root", projectId: "p1", lastOpenedAt: OLD }),
        c({
          id: "child",
          projectId: "p1",
          parentTrunkId: "root",
          lastOpenedAt: RECENT,
        }),
      ],
    });
    expect(result.trunkIds).toEqual([]);
    expect(result.projectIds).toEqual([]);
  });
});
