export type CloseTabPromptResult = "closed" | "cancelled";

let handler: ((id: string) => Promise<CloseTabPromptResult>) | null = null;

export function registerCloseTabPromptHandler(
  next: ((id: string) => Promise<CloseTabPromptResult>) | null,
): void {
  handler = next;
}

export async function promptCloseTab(id: string): Promise<CloseTabPromptResult> {
  if (!handler) return "cancelled";
  return handler(id);
}
