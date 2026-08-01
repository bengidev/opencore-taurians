import { describe, expect, it } from "vitest";
import type { SourceControlRepositorySnapshot } from "../api/sourceControlContracts";
import { resolveSourceControlQuickActions } from "./sourceControlQuickAction";

const baseSnapshot: SourceControlRepositorySnapshot = {
  scopeId: "scope-1",
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
  remotes: [{ name: "origin", fetchUrl: "", pushUrl: "", provider: null }],
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

function lookup(actions: ReturnType<typeof resolveSourceControlQuickActions>, id: string) {
  return actions.find((a) => a.id === id)!;
}

describe("resolveSourceControlQuickActions", () => {
  it("disables all actions when snapshot is null", () => {
    const actions = resolveSourceControlQuickActions(null);
    expect(actions.map((a) => a.id)).toEqual(["fetch", "pull", "push", "commit"]);
    for (const action of actions) {
      expect(action.enabled).toBe(false);
      expect(action.reason).toBe("No active repository");
    }
  });

  it("disables all actions when repository is not ready", () => {
    const snapshot = { ...baseSnapshot, repositoryState: "not-repository" as const };
    const actions = resolveSourceControlQuickActions(snapshot);
    for (const action of actions) {
      expect(action.enabled).toBe(false);
      expect(action.reason).toBe("No active repository");
    }
  });

  it("enables fetch only with a remote and disables pull/push when up to date", () => {
    const actions = resolveSourceControlQuickActions(baseSnapshot);
    expect(lookup(actions, "fetch").enabled).toBe(true);
    expect(lookup(actions, "fetch").reason).toBeNull();

    expect(lookup(actions, "pull").enabled).toBe(false);
    expect(lookup(actions, "pull").reason).toBe("Up to date");

    expect(lookup(actions, "push").enabled).toBe(false);
    expect(lookup(actions, "push").reason).toBe("Up to date");

    expect(lookup(actions, "commit").enabled).toBe(false);
    expect(lookup(actions, "commit").reason).toBe("Nothing to commit");
  });

  it("disables fetch when no remote is configured", () => {
    const snapshot = { ...baseSnapshot, remotes: [] };
    const actions = resolveSourceControlQuickActions(snapshot);
    expect(lookup(actions, "fetch").enabled).toBe(false);
    expect(lookup(actions, "fetch").reason).toBe("No remote configured");
  });

  it("enables pull when behind and disables push when no ahead commits", () => {
    const snapshot = { ...baseSnapshot, behind: 3 };
    const actions = resolveSourceControlQuickActions(snapshot);
    expect(lookup(actions, "pull").enabled).toBe(true);
    expect(lookup(actions, "push").enabled).toBe(false);
    expect(lookup(actions, "push").reason).toBe("Up to date");
  });

  it("enables push when ahead and disables pull when up to date", () => {
    const snapshot = { ...baseSnapshot, ahead: 2 };
    const actions = resolveSourceControlQuickActions(snapshot);
    expect(lookup(actions, "push").enabled).toBe(true);
    expect(lookup(actions, "pull").enabled).toBe(false);
    expect(lookup(actions, "pull").reason).toBe("Up to date");
  });

  it("handles diverged state with both ahead and behind", () => {
    const snapshot = { ...baseSnapshot, ahead: 2, behind: 3 };
    const actions = resolveSourceControlQuickActions(snapshot);
    expect(lookup(actions, "push").enabled).toBe(true);
    expect(lookup(actions, "pull").enabled).toBe(true);
  });

  it("disables pull and push when upstream is not set", () => {
    const snapshot = { ...baseSnapshot, upstream: null };
    const actions = resolveSourceControlQuickActions(snapshot);
    expect(lookup(actions, "pull").enabled).toBe(false);
    expect(lookup(actions, "pull").reason).toBe("No upstream branch");
    expect(lookup(actions, "push").enabled).toBe(false);
    expect(lookup(actions, "push").reason).toBe("No upstream branch");
  });

  it("enables commit when there are working-tree or staged changes", () => {
    const snapshot = { ...baseSnapshot, sectionCounts: { ...baseSnapshot.sectionCounts, changes: 1 } };
    const actions = resolveSourceControlQuickActions(snapshot);
    expect(lookup(actions, "commit").enabled).toBe(true);
    expect(lookup(actions, "commit").reason).toBeNull();
  });

  it("enables commit when there are only staged changes", () => {
    const snapshot = {
      ...baseSnapshot,
      sectionCounts: { ...baseSnapshot.sectionCounts, stagedChanges: 1 },
    };
    const actions = resolveSourceControlQuickActions(snapshot);
    expect(lookup(actions, "commit").enabled).toBe(true);
  });

  it("disables all actions when there are unresolved conflicts", () => {
    const snapshot = {
      ...baseSnapshot,
      conflictCount: 1,
      sectionCounts: { ...baseSnapshot.sectionCounts, stagedChanges: 1 },
    };
    const actions = resolveSourceControlQuickActions(snapshot);
    for (const action of actions) {
      expect(action.enabled).toBe(false);
      expect(action.reason).toBe("Resolve conflicts first");
    }
  });

  it("keeps labels unchanged across all states", () => {
    const actions = resolveSourceControlQuickActions(baseSnapshot);
    expect(lookup(actions, "fetch").label).toBe("Fetch");
    expect(lookup(actions, "pull").label).toBe("Pull");
    expect(lookup(actions, "push").label).toBe("Push");
    expect(lookup(actions, "commit").label).toBe("Commit");
  });
});
