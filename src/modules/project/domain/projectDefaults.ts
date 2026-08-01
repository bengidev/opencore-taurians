import type { ProjectTrunkRestore } from "./projectTypes";

export const DEFAULT_ROOT_TRUNK_TITLE = "default";
export const DEFAULT_NEW_TRUNK_TITLE = "new trunk";

export function createDefaultRootTrunkRestore(): ProjectTrunkRestore {
  return {
    activeMainCard: "chat",
    rightPanelFeature: "files",
    gitCheckout: {
      kind: "project-root",
      repositoryIdentity: null,
      savedRefName: null,
    },
  };
}
