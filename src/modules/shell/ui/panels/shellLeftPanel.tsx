import { useShellStore } from "../../state/shellStore";
import { ShellPanelResizeHandle } from "../shellPanelResizeHandle";

export function ShellLeftPanel() {
  const setLeftPanelWidth = useShellStore((s) => s.setLeftPanelWidth);

  return (
    <aside
      aria-label="left panel"
      className="relative flex min-h-0 min-w-0 flex-col border-r border-border bg-background"
    >
      <ShellPanelResizeHandle
        edge="end"
        ariaLabel="Resize left panel"
        getWidth={() => useShellStore.getState().leftPanelWidth}
        onResize={setLeftPanelWidth}
      />
      <p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Left Panel
      </p>
      <div className="min-h-0 flex-1 p-3" />
    </aside>
  );
}
