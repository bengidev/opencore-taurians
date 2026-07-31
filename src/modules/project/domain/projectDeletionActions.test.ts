import { describe, it, expect } from "vitest";
import { projectEnumerateDeletion } from "./projectDeletionActions";
import type { ProjectTrunk } from "./projectTypes";

function makeTrunk(
  overrides: Partial<ProjectTrunk> & { id: string; projectId: string },
): ProjectTrunk {
  return {
    parentTrunkId: null,
    title: "trunk",
    pinned: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-07-01T00:00:00.000Z",
    siblingOrder: 0,
    restore: {
      activeMainCard: "chat",
      rightPanelFeature: "files",
      gitCheckout: {
        kind: "project-root",
        repositoryIdentity: null,
        savedRefName: null,
      },
    },
    ...overrides,
  };
}

describe("projectEnumerateDeletion", () => {
  it("collects target trunk and its children", () => {
    const trunks = [
      makeTrunk({ id: "t1", projectId: "p1" }),
      makeTrunk({ id: "t2", projectId: "p1", parentTrunkId: "t1" }),
      makeTrunk({ id: "t3", projectId: "p1", parentTrunkId: "t2" }),
    ];

    const result = projectEnumerateDeletion({
      targetTrunkId: "t1",
      trunks,
    });

    expect(result.trunkIds).toContain("t1");
    expect(result.trunkIds).toContain("t2");
    expect(result.trunkIds).toContain("t3");
    // p1 still has no other trunks, so it's included
    expect(result.projectIds).toContain("p1");
  });

  it("does not include project when sibling trunks remain", () => {
    const trunks = [
      makeTrunk({ id: "t1", projectId: "p1" }),
      makeTrunk({ id: "t2", projectId: "p1" }),
    ];

    const result = projectEnumerateDeletion({
      targetTrunkId: "t1",
      trunks,
    });

    expect(result.trunkIds).toEqual(["t1"]);
    expect(result.projectIds).toEqual([]);
  });

  it("identifies app-managed worktree trunks", () => {
    const trunks = [
      makeTrunk({
        id: "root",
        projectId: "p1",
        restore: {
          activeMainCard: "chat",
          rightPanelFeature: "files",
          gitCheckout: {
            kind: "project-root",
            repositoryIdentity: null,
            savedRefName: null,
          },
        },
      }),
      makeTrunk({
        id: "child",
        projectId: "p1",
        parentTrunkId: "root",
        restore: {
          activeMainCard: "chat",
          rightPanelFeature: "git",
          gitCheckout: {
            kind: "worktree",
            worktreePath: "/app-data/worktrees/child",
            repositoryIdentity: "repo:xyz",
            savedRefName: "feature/x",
            managedByApp: true,
          },
        },
      }),
    ];

    const result = projectEnumerateDeletion({
      targetTrunkId: "root",
      trunks,
    });

    expect(result.appManagedWorktreeTrunkIds).toContain("child");
    expect(result.attachedWorktreeTrunkIds).toHaveLength(0);
  });

  it("identifies attached (non-managed) worktree trunks", () => {
    const trunks = [
      makeTrunk({
        id: "root",
        projectId: "p1",
        restore: {
          activeMainCard: "chat",
          rightPanelFeature: "files",
          gitCheckout: {
            kind: "project-root",
            repositoryIdentity: null,
            savedRefName: null,
          },
        },
      }),
      makeTrunk({
        id: "attached",
        projectId: "p1",
        parentTrunkId: "root",
        restore: {
          activeMainCard: "chat",
          rightPanelFeature: "git",
          gitCheckout: {
            kind: "worktree",
            worktreePath: "/some/external/path",
            repositoryIdentity: "repo:xyz",
            savedRefName: "feature/y",
            managedByApp: false,
          },
        },
      }),
    ];

    const result = projectEnumerateDeletion({
      targetTrunkId: "root",
      trunks,
    });

    expect(result.attachedWorktreeTrunkIds).toContain("attached");
    expect(result.appManagedWorktreeTrunkIds).toHaveLength(0);
  });

  it("returns empty for nonexistent trunk", () => {
    const result = projectEnumerateDeletion({
      targetTrunkId: "nonexistent",
      trunks: [],
    });

    expect(result.trunkIds).toEqual([]);
    expect(result.projectIds).toEqual([]);
  });

  it("collects all project trunks for project-level deletion", () => {
    const trunks = [
      makeTrunk({ id: "t1", projectId: "p1" }),
      makeTrunk({ id: "t2", projectId: "p1", parentTrunkId: "t1" }),
    ];

    const result = projectEnumerateDeletion({
      targetProjectId: "p1",
      trunks,
    });

    expect(result.trunkIds).toContain("t1");
    expect(result.trunkIds).toContain("t2");
    expect(result.projectIds).toEqual(["p1"]);
  });
});
