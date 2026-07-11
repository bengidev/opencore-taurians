import { describe, expect, it } from "vitest";
import { projectBuildAutoGroups } from "./projectAutoGroup";
import type { Project } from "./projectTypes";

const base = {
  pinned: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastOpenedAt: "2026-01-01T00:00:00.000Z",
  listOrder: 0,
};

describe("projectBuildAutoGroups", () => {
  it("groups by parent directory and leaves manual-grouped projects out", () => {
    const projects: Project[] = [
      { ...base, id: "1", name: "a", folderPath: "/work/apps/a" },
      { ...base, id: "2", name: "b", folderPath: "/work/apps/b" },
      {
        ...base,
        id: "3",
        name: "c",
        folderPath: "/work/other/c",
        manualGroupId: "g1",
      },
    ];
    const groups = projectBuildAutoGroups(projects);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("/work/apps");
    expect(groups[0]?.label).toBe("apps");
    expect(groups[0]?.projectIds.sort()).toEqual(["1", "2"]);
  });
});
