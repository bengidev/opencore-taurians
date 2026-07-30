import { describe, expect, it } from "vitest";
import {
  projectDefaultRootRestore,
  projectNormalizeTrunkRestore,
} from "./projectRestore";

describe("project trunk restore", () => {
  it("defaults a root trunk to Files and the project checkout", () => {
    expect(projectDefaultRootRestore()).toEqual({
      activeMainCard: "chat",
      rightPanelFeature: "files",
      gitCheckout: {
        kind: "project-root",
        repositoryIdentity: null,
        savedRefName: null,
      },
    });
  });

  it("migrates legacy restore while preserving the selected main card", () => {
    expect(
      projectNormalizeTrunkRestore({ activeMainCard: "editor" }, { isRootTrunk: true }),
    ).toEqual({
      activeMainCard: "editor",
      rightPanelFeature: "files",
      gitCheckout: {
        kind: "project-root",
        repositoryIdentity: null,
        savedRefName: null,
      },
    });
  });

  it("preserves valid Git and worktree metadata", () => {
    expect(
      projectNormalizeTrunkRestore(
        {
          activeMainCard: "terminal",
          rightPanelFeature: "git",
          gitCheckout: {
            kind: "worktree",
            worktreePath: "/work/tree",
            repositoryIdentity: "repo-1",
            savedRefName: "feature/x",
            managedByApp: true,
            ignored: "value",
          },
          ignored: "value",
        },
        { isRootTrunk: false },
      ),
    ).toEqual({
      activeMainCard: "terminal",
      rightPanelFeature: "git",
      gitCheckout: {
        kind: "worktree",
        worktreePath: "/work/tree",
        repositoryIdentity: "repo-1",
        savedRefName: "feature/x",
        managedByApp: true,
      },
    });
  });

  it("keeps a malformed child worktree invalid instead of falling back", () => {
    expect(projectNormalizeTrunkRestore({}, { isRootTrunk: false })).toEqual({
      activeMainCard: "chat",
      rightPanelFeature: "files",
      gitCheckout: {
        kind: "worktree",
        worktreePath: "",
        repositoryIdentity: "",
        savedRefName: null,
        managedByApp: false,
      },
    });
  });

  it("normalizes unknown values safely", () => {
    expect(
      projectNormalizeTrunkRestore(
        {
          activeMainCard: "unknown",
          rightPanelFeature: "unknown",
          gitCheckout: { kind: "unknown" },
        },
        { isRootTrunk: true },
      ),
    ).toEqual(projectDefaultRootRestore());
  });
});
