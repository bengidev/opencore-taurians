export type QuitUntitledResult = "saved" | "discarded" | "cancelled" | "failed";

let quitHandler: ((id: string) => Promise<QuitUntitledResult>) | null = null;
let saveAsRequestHandler: ((id: string) => void) | null = null;

export function registerQuitUntitledHandler(
  handler: ((id: string) => Promise<QuitUntitledResult>) | null,
): void {
  quitHandler = handler;
}

export async function promptQuitUntitled(id: string): Promise<QuitUntitledResult> {
  if (!quitHandler) return "cancelled";
  return quitHandler(id);
}

export function registerSaveAsRequestHandler(
  handler: ((id: string) => void) | null,
): void {
  saveAsRequestHandler = handler;
}

export function requestSaveAs(id: string): void {
  saveAsRequestHandler?.(id);
}
