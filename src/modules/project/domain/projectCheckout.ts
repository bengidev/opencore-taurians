import type {
  SourceControlCheckoutInvalidReason,
  ResolvedSourceControlCheckout,
} from "../../source-control/api/sourceControlContracts";

export type ProjectCheckoutRuntimeState =
  | { status: "unresolved" }
  | { status: "resolving" }
  | { status: "ready"; checkout: ResolvedSourceControlCheckout }
  | {
      status: "invalid";
      safeWorkspacePath: string;
      reason: SourceControlCheckoutInvalidReason;
      message: string;
      worktreePath: string | null;
      repositoryIdentity: string | null;
      savedRefName: string | null;
    };

export type ProjectActivationResult =
  | { status: "activated"; checkout: ResolvedSourceControlCheckout }
  | { status: "checkout-invalid"; reason: SourceControlCheckoutInvalidReason }
  | { status: "superseded" }
  | { status: "not-found" };
