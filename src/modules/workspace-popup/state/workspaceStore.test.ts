import { beforeEach, describe, expect, it } from "vitest";
import { useMemoryPersistStorage } from "../../session/infrastructure/sessionPersistStorage";
import { useWorkspaceStore } from "./workspaceStore";

describe("workspaceStore", () => {
  beforeEach(() => {
    useMemoryPersistStorage();
    useWorkspaceStore.setState({ workspacePath: null });
  });

  it("setWorkspace stores the path", () => {
    useWorkspaceStore.getState().setWorkspace("/tmp/demo");
    expect(useWorkspaceStore.getState().workspacePath).toBe("/tmp/demo");
  });

  it("clearWorkspace removes the path", () => {
    useWorkspaceStore.getState().setWorkspace("/tmp/demo");
    useWorkspaceStore.getState().clearWorkspace();
    expect(useWorkspaceStore.getState().workspacePath).toBeNull();
  });
});
