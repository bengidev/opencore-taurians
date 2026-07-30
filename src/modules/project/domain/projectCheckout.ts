import type {
  GitCheckoutInvalidReason,
  ResolvedGitCheckout,
} from "../../git/api/gitContracts";

export type ProjectCheckoutRuntimeState =
  | { status: "unresolved" }
  | { status: "resolving" }
  | { status: "ready"; checkout: ResolvedGitCheckout }
  | {
      status: "invalid";
      safeWorkspacePath: string;
      reason: GitCheckoutInvalidReason;
      message: string;
      worktreePath: string | null;
      repositoryIdentity: string | null;
      savedRefName: string | null;
    };

export type ProjectActivationResult =
  | { status: "activated"; checkout: ResolvedGitCheckout }
  | { status: "checkout-invalid"; reason: GitCheckoutInvalidReason }
  | { status: "superseded" }
  | { status: "not-found" };
