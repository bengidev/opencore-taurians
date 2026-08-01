import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySourceControlApi } from "../../source-control";
import type { ResolvedSourceControlCheckout } from "../../source-control/api/sourceControlContracts";
import type { ProjectTrunk } from "../domain/projectTypes";
import { useProjectStore } from "./projectStore";
import {
  projectCreateChildTrunk,
  projectExecuteDeletion,
} from "./projectWorktreeActions";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useChatStore } from "../../chat/state/chatStore";
import { useWorkspaceStore } from "../../workspace-popup/state/workspaceStore";

function worktreeCheckout(path: string): ResolvedSourceControlCheckout {
  return {
    kind: "worktree",
    scopeId: "scope-child",
    checkoutPath: path,
    checkoutIdentity: `checkout:${path}`,
    repositoryIdentity: "repository:/tmp/repo.git",
    savedRefName: "feature/child",
    managedByApp: true,
    normalizedRestore: {
      kind: "worktree",
      worktreePath: path,
      repositoryIdentity: "repository:/tmp/repo.git",
      savedRefName: "feature/child",
      managedByApp: true,
    },
  };
}

describe("projectCreateChildTrunk", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useChatStore.getState().resetChat();
    useWorkspaceStore.setState({ workspacePath: null });
  });

  it("calls native create with real project id, path, and reserved trunk id", async () => {
    const { project, trunk: root } = useProjectStore
      .getState()
      .createProjectWithRootTrunk({
        folderPath: "/work/app",
        nowIso: "2026-07-10T00:00:00.000Z",
      });

    const api = createMemorySourceControlApi();
    const createWorktree = vi.fn(async (input) => {
      expect(input.projectId).toBe(project.id);
      expect(input.projectFolderPath).toBe("/work/app");
      expect(input.parentTrunkId).toBe(root.id);
      expect(input.trunkId).toMatch(/^[0-9a-f-]{36}$/i);
      return { checkout: worktreeCheckout("/app-data/worktrees/child") };
    });
    api.createWorktree = createWorktree;

    const result = await projectCreateChildTrunk({
      projectId: project.id,
      projectFolderPath: project.folderPath,
      parentTrunkId: root.id,
      parentScopeId: "scope-root",
      baseRefName: "main",
      branchName: "feature/child",
      historyMode: "normal",
      nowIso: "2026-07-10T00:00:01.000Z",
      sourceControlApi: api,
    });

    expect(createWorktree).toHaveBeenCalledOnce();
    expect(result.trunk.parentTrunkId).toBe(root.id);
    expect(result.checkout.scopeId).toBe("scope-child");
    expect(result.trunk.restore.gitCheckout).toEqual(
      result.checkout.normalizedRestore,
    );
    expect(
      useProjectStore.getState().checkoutRuntimeByTrunkId[result.trunk.id],
    ).toEqual({ status: "ready", checkout: result.checkout });
  });

  it("does not persist child metadata when native create fails", async () => {
    const { project, trunk: root } = useProjectStore
      .getState()
      .createProjectWithRootTrunk({
        folderPath: "/work/app",
        nowIso: "2026-07-10T00:00:00.000Z",
      });

    const api = createMemorySourceControlApi();
    api.createWorktree = vi.fn(async () => {
      throw new Error("native failed");
    });

    await expect(
      projectCreateChildTrunk({
        projectId: project.id,
        projectFolderPath: project.folderPath,
        parentTrunkId: root.id,
        parentScopeId: "scope-root",
        baseRefName: "main",
        branchName: "feature/child",
        historyMode: "normal",
        nowIso: "2026-07-10T00:00:01.000Z",
        sourceControlApi: api,
      }),
    ).rejects.toThrow("native failed");

    expect(useProjectStore.getState().trunks).toHaveLength(1);
  });
});

describe("projectExecuteDeletion", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useProjectStore.getState().resetProjectState();
    useChatStore.getState().resetChat();
    useWorkspaceStore.setState({ workspacePath: null });
  });

  function seedManagedChild(): { root: ProjectTrunk; child: ProjectTrunk } {
    const { trunk: root } = useProjectStore
      .getState()
      .createProjectWithRootTrunk({
        folderPath: "/work/app",
        nowIso: "2026-07-10T00:00:00.000Z",
      });
    const child = useProjectStore.getState().addChildTrunk({
      trunkId: "child-trunk",
      parentTrunkId: root.id,
      title: "feature/x",
      nowIso: "2026-07-10T00:00:01.000Z",
      gitCheckout: {
        kind: "worktree",
        worktreePath: "/app-data/worktrees/child",
        repositoryIdentity: "repository:/tmp/repo.git",
        savedRefName: "feature/x",
        managedByApp: true,
      },
    })!;
    useProjectStore.getState().setCheckoutRuntime(child.id, {
      status: "ready",
      checkout: worktreeCheckout("/app-data/worktrees/child"),
    });
    return { root, child };
  }

  it("inspects and removes managed worktrees before deleting metadata", async () => {
    const { root, child } = seedManagedChild();
    const api = createMemorySourceControlApi();
    const inspectWorktreeRemoval = vi.fn(async () => ({
      worktreePath: "/app-data/worktrees/child",
      repositoryIdentity: "repository:/tmp/repo.git",
      managedByApp: true,
      dirty: false,
      hasUnmergedChanges: false,
      hasUnmergedCommits: false,
      headOid: "abc123",
      affectedTrunkIds: [child.id],
    }));
    const removeWorktree = vi.fn(async () => undefined);
    api.inspectWorktreeRemoval = inspectWorktreeRemoval;
    api.removeWorktree = removeWorktree;

    await projectExecuteDeletion({
      targetTrunkId: root.id,
      sourceControlApi: api,
    });

    expect(inspectWorktreeRemoval).toHaveBeenCalledBefore(removeWorktree);
    expect(removeWorktree).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeId: "scope-child",
        expectedHeadOid: "abc123",
      }),
    );
    expect(useProjectStore.getState().trunks.find((t) => t.id === child.id)).toBeUndefined();
  });

  it("skips native removal for attached worktrees", async () => {
    const { trunk: root } = useProjectStore
      .getState()
      .createProjectWithRootTrunk({
        folderPath: "/work/app",
        nowIso: "2026-07-10T00:00:00.000Z",
      });
    const attached = useProjectStore.getState().addChildTrunk({
      trunkId: "attached-trunk",
      parentTrunkId: root.id,
      title: "attached",
      nowIso: "2026-07-10T00:00:01.000Z",
      gitCheckout: {
        kind: "worktree",
        worktreePath: "/external/wt",
        repositoryIdentity: "repository:/tmp/repo.git",
        savedRefName: "feature/y",
        managedByApp: false,
      },
    })!;

    const api = createMemorySourceControlApi();
    const inspectWorktreeRemoval = vi.fn();
    const removeWorktree = vi.fn();
    api.inspectWorktreeRemoval = inspectWorktreeRemoval;
    api.removeWorktree = removeWorktree;

    await projectExecuteDeletion({
      targetTrunkId: root.id,
      sourceControlApi: api,
    });

    expect(inspectWorktreeRemoval).not.toHaveBeenCalled();
    expect(removeWorktree).not.toHaveBeenCalled();
    expect(
      useProjectStore.getState().trunks.find((t) => t.id === attached.id),
    ).toBeUndefined();
  });
});
