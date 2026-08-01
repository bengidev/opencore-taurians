import type { ShellMainCard } from "../../shell/state/shellStore";
import type {
  SourceControlCheckoutRestore,
  ProjectTrunkRestore,
  RightPanelFeature,
} from "./projectTypes";

const MAIN_CARDS = new Set<ShellMainCard>(["chat", "terminal", "editor"]);

export function projectDefaultRootRestore(): ProjectTrunkRestore {
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

export function projectDefaultChildRestore(): ProjectTrunkRestore {
  return {
    activeMainCard: "chat",
    rightPanelFeature: "files",
    gitCheckout: {
      kind: "worktree",
      worktreePath: "",
      repositoryIdentity: "",
      savedRefName: null,
      managedByApp: false,
    },
  };
}

export function projectNormalizeTrunkRestore(
  value: unknown,
  input: { isRootTrunk: boolean },
): ProjectTrunkRestore {
  const fallback = input.isRootTrunk
    ? projectDefaultRootRestore()
    : projectDefaultChildRestore();
  if (!isRecord(value)) return fallback;
  return {
    activeMainCard: normalizeMainCard(value.activeMainCard),
    rightPanelFeature: normalizeFeature(value.rightPanelFeature),
    gitCheckout: normalizeCheckout(value.gitCheckout, input.isRootTrunk),
  };
}

export function projectCheckoutRestoreIsMalformed(checkout: SourceControlCheckoutRestore): boolean {
  return (
    checkout.kind === "worktree" &&
    (checkout.worktreePath.length === 0 || checkout.repositoryIdentity.length === 0)
  );
}

function normalizeMainCard(value: unknown): ShellMainCard {
  return typeof value === "string" && MAIN_CARDS.has(value as ShellMainCard)
    ? (value as ShellMainCard)
    : "chat";
}

function normalizeFeature(value: unknown): RightPanelFeature {
  return value === "git" ? "git" : "files";
}

function normalizeCheckout(value: unknown, isRootTrunk: boolean): SourceControlCheckoutRestore {
  if (!isRecord(value)) {
    return isRootTrunk
      ? projectDefaultRootRestore().gitCheckout
      : projectDefaultChildRestore().gitCheckout;
  }
  if (value.kind === "project-root" && isRootTrunk) {
    return {
      kind: "project-root",
      repositoryIdentity: nullableString(value.repositoryIdentity),
      savedRefName: nullableString(value.savedRefName),
    };
  }
  if (value.kind === "worktree" || !isRootTrunk) {
    return {
      kind: "worktree",
      worktreePath: stringOrEmpty(value.worktreePath),
      repositoryIdentity: stringOrEmpty(value.repositoryIdentity),
      savedRefName: nullableString(value.savedRefName),
      managedByApp: value.managedByApp === true,
    };
  }
  return projectDefaultRootRestore().gitCheckout;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
