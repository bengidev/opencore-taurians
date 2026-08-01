import type { PublicSourceControlError } from "../api/sourceControlContracts";

const PUBLIC_ERROR_CODES = new Set<PublicSourceControlError["code"]>([
  "git-unavailable",
  "not-repository",
  "checkout-invalid",
  "scope-violation",
  "not-found",
  "precondition-failed",
  "ref-selection-required",
  "authentication-required",
  "timeout",
  "output-limit",
  "cancelled",
  "process-failed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parsePublicSourceControlError(error: unknown): PublicSourceControlError | null {
  if (!isRecord(error)) return null;
  const code = error.code;
  const message = error.message;
  const operation = error.operation;
  const retryable = error.retryable;
  if (
    typeof code !== "string" ||
    !PUBLIC_ERROR_CODES.has(code as PublicSourceControlError["code"]) ||
    typeof message !== "string" ||
    typeof operation !== "string" ||
    typeof retryable !== "boolean"
  ) {
    return null;
  }
  return {
    code: code as PublicSourceControlError["code"],
    operation,
    message,
    retryable,
  };
}

export function toPublicSourceControlError(
  error: unknown,
  fallbackOperation: string,
): PublicSourceControlError {
  const parsed = parsePublicSourceControlError(error);
  if (parsed) return parsed;
  return {
    code: "process-failed",
    operation: fallbackOperation,
    message: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
}
