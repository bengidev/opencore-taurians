import { describe, expect, it } from "vitest";
import {
  projectCollectTrunkWithChildrenIds,
  projectFlattenTrunks,
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

  it("lists root trunks sorted by siblingOrder", () => {
    expect(projectListChildTrunks(trunks, null).map((c) => c.id)).toEqual(["r"]);
  });

  it("collects only the trunk id (flat model)", () => {
    expect(projectCollectTrunkWithChildrenIds(trunks, "r")).toEqual(["r"]);
    expect(projectCollectTrunkWithChildrenIds(trunks, "a")).toEqual(["a"]);
  });

  it("reorders root trunks", () => {
    const flat = projectFlattenTrunks(trunks);
    const next = projectReorderSiblingTrunks(flat, null, ["b", "a", "r", "a1"]);
    expect(projectListChildTrunks(next, null).map((c) => c.id)).toEqual(["b", "a", "r", "a1"]);
  });

  it("promotes nested trunks to the project root list", () => {
    expect(projectFlattenTrunks(trunks).every((trunk) => trunk.parentTrunkId === null)).toBe(
      true,
    );
    expect(projectFlattenTrunks(trunks).map((trunk) => trunk.id).sort()).toEqual([
      "a",
      "a1",
      "b",
      "r",
    ]);
  });
});
