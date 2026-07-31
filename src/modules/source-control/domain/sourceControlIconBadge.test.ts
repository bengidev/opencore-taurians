import { describe, expect, it } from "vitest";
import type { SourceControlRepositorySnapshot } from "../api/sourceControlContracts";
import { resolveSourceControlBadge } from "./sourceControlIconBadge";

const baseSnapshot: SourceControlRepositorySnapshot = {
  projectId: "project-1",
  trunkId: "trunk-1",
  checkoutPath: "/work/app",
  checkoutIdentity: "checkout-1",
  repositoryIdentity: "repo-1",
  revision: 1,
  capturedAt: "2026-07-29T00:00:00.000Z",
  repositoryState: "ready",
  worktreeLabel: "app",
  head: { kind: "branch", name: "main" },
  upstream: "origin/main",
  defaultBranch: "main",
  ahead: 0,
  behind: 0,
  files: [],
  conflictCount: 0,
  operation: null,
  remotes: [],
  sectionCounts: {
    changes: 0,
    stagedChanges: 0,
    stashes: 0,
    worktrees: 1,
    submodules: 0,
    lfsPatterns: 0,
  },
  capabilities: {
    gitVersion: "2.50.0",
    supportsWorktrees: true,
    lfsAvailable: false,
  },
};

describe("resolveSourceControlBadge", () => {
  it("returns none for a clean ready snapshot", () => {
    expect(resolveSourceControlBadge(baseSnapshot)).toEqual({ kind: "none", count: 0 });
  });

  it("returns none for null snapshot", () => {
    expect(resolveSourceControlBadge(null)).toEqual({ kind: "none", count: 0 });
  });

  it("conflict beats every other state", () => {
    const snapshot = {
      ...baseSnapshot,
      conflictCount: 1,
      ahead: 5,
      behind: 5,
      sectionCounts: { ...baseSnapshot.sectionCounts, changes: 5 },
    };
    expect(resolveSourceControlBadge(snapshot)).toEqual({ kind: "conflict", count: 1 });
  });

  it("diverged beats dirty, ahead, and behind", () => {
    const snapshot = {
      ...baseSnapshot,
      ahead: 2,
      behind: 3,
      sectionCounts: { ...baseSnapshot.sectionCounts, changes: 5 },
    };
    expect(resolveSourceControlBadge(snapshot)).toEqual({ kind: "diverged", count: 5 });
  });

  it("dirty beats ahead alone and behind alone", () => {
    const snapshot = {
      ...baseSnapshot,
      ahead: 4,
      behind: 0,
      sectionCounts: { ...baseSnapshot.sectionCounts, changes: 2 },
    };
    expect(resolveSourceControlBadge(snapshot)).toEqual({ kind: "dirty", count: 2 });
  });

  it("ahead beats behind", () => {
    const snapshot = { ...baseSnapshot, ahead: 2, behind: 3 };
    expect(resolveSourceControlBadge(snapshot)).toEqual({ kind: "diverged", count: 5 });
  });

  it("shows behind when only behind", () => {
    const snapshot = { ...baseSnapshot, behind: 7 };
    expect(resolveSourceControlBadge(snapshot)).toEqual({ kind: "behind", count: 7 });
  });

  it("caps count at 99", () => {
    const snapshot = {
      ...baseSnapshot,
      conflictCount: 150,
    };
    expect(resolveSourceControlBadge(snapshot)).toEqual({ kind: "conflict", count: 99 });
  });

  it("caps diverged combined count at 99", () => {
    const snapshot = {
      ...baseSnapshot,
      ahead: 60,
      behind: 60,
    };
    expect(resolveSourceControlBadge(snapshot)).toEqual({ kind: "diverged", count: 99 });
  });
});
