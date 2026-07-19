import { ExplorerPanel } from "../../../explorer";

export function ShellRightPanel() {
  return (
    <aside
      aria-label="right panel"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background"
    >
      <ExplorerPanel />
    </aside>
  );
}
