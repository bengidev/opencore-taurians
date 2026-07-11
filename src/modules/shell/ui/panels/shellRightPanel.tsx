export function ShellRightPanel() {
  return (
    <aside
      aria-label="right panel"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background"
    >
      <p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Right Panel
      </p>
      <div className="min-h-0 flex-1 p-3" />
    </aside>
  );
}
