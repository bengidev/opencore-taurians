import { ProjectLeftPanel } from "../../../project";
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
      <ProjectLeftPanel />
    </aside>
  );
}
