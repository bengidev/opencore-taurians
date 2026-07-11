import { describe, expect, it } from "vitest";
import { projectMigrateFromWorkspace } from "./projectMigrate";

describe("projectMigrateFromWorkspace", () => {
  it("returns null when workspace missing or projects already exist", () => {
    expect(
      projectMigrateFromWorkspace({
        workspacePath: null,
        existingProjectCount: 0,
        nowIso: "2026-07-10T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      projectMigrateFromWorkspace({
        workspacePath: "/work/app",
        existingProjectCount: 1,
        nowIso: "2026-07-10T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("builds one project and one root chunk", () => {
    const result = projectMigrateFromWorkspace({
      workspacePath: "/work/app",
      existingProjectCount: 0,
      nowIso: "2026-07-10T00:00:00.000Z",
      projectId: "p1",
      chunkId: "c1",
    });
    expect(result?.project.name).toBe("app");
    expect(result?.project.folderPath).toBe("/work/app");
    expect(result?.chunk.parentChunkId).toBeNull();
    expect(result?.chunk.projectId).toBe("p1");
  });
});
