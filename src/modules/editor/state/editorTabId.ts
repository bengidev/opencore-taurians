const UNTITLED_RE = /^untitled:(\d+)$/;

export function isUntitledId(id: string): boolean {
  return UNTITLED_RE.test(id);
}

export function tabLabel(id: string): string {
  const m = UNTITLED_RE.exec(id);
  if (m) return `Untitled-${m[1]}`;
  return id.split(/[/\\]/).pop() ?? id;
}
