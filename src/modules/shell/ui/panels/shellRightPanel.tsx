import { useShellStore } from "../../state/shellStore";
import { ShellPanelResizeHandle } from "../shellPanelResizeHandle";
import { ShellRightPanelHeader } from "./shellRightPanelHeader";

export function ShellRightPanel() {
  const setRightPanelWidth = useShellStore((s) => s.setRightPanelWidth);

  return (
    <aside
      aria-label="right panel"
      className="relative flex min-h-0 min-w-0 flex-col border-l border-border bg-background"
    >
      <ShellPanelResizeHandle
        edge="start"
        ariaLabel="Resize right panel"
        getWidth={() => useShellStore.getState().rightPanelWidth}
        onResize={setRightPanelWidth}
      />
      <ShellRightPanelHeader />
      <p className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        Right Panel
      </p>
      <div className="min-h-0 flex-1 p-3" />
    </aside>
  );
}
