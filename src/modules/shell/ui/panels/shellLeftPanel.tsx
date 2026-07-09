export function ShellLeftPanel() {
  return (
    <aside
      aria-label="left panel"
      className="flex min-h-0 w-52 flex-col border-r border-border bg-background"
    >
      <p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Left Panel
      </p>
      <div className="min-h-0 flex-1 p-3" />
    </aside>
  );
}
