import { describe, expect, it } from "vitest";
import {
  projectCollectTrunkWithChildrenIds,
  projectListChildTrunks,
  projectReorderSiblingTrunks,
} from "./projectTrunkTree";
import type { ProjectTrunk } from "./projectTypes";

function trunk(
  partial: Pick<ProjectTrunk, "id" | "projectId" | "parentTrunkId" | "title"> &
    Partial<ProjectTrunk>,
): ProjectTrunk {
  return {
    pinned: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    restore: { activeMainCard: "chat" },
    siblingOrder: 0,
    ...partial,
  };
}

describe("projectTrunkTree", () => {
  const trunks: ProjectTrunk[] = [
    trunk({ id: "r", projectId: "p", parentTrunkId: null, title: "root", siblingOrder: 0 }),
    trunk({ id: "a", projectId: "p", parentTrunkId: "r", title: "a", siblingOrder: 0 }),
    trunk({ id: "b", projectId: "p", parentTrunkId: "r", title: "b", siblingOrder: 1 }),
    trunk({ id: "a1", projectId: "p", parentTrunkId: "a", title: "a1", siblingOrder: 0 }),
  ];

  it("lists children sorted by siblingOrder", () => {
    expect(projectListChildTrunks(trunks, "r").map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("collects trunk id and direct children only", () => {
    expect(projectCollectTrunkWithChildrenIds(trunks, "r").sort()).toEqual(["a", "b", "r"]);
    expect(projectCollectTrunkWithChildrenIds(trunks, "a")).toEqual(["a"]);
  });

  it("reorders siblings under the same parent", () => {
    const next = projectReorderSiblingTrunks(trunks, "r", ["b", "a"]);
    expect(projectListChildTrunks(next, "r").map((c) => c.id)).toEqual(["b", "a"]);
  });
});
