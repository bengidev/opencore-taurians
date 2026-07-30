export function GitPanel() {
  return (
    <aside
      aria-label="source control panel"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="shrink-0 border-b border-border px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Source control
        </p>
      </header>
    </aside>
  );
}
