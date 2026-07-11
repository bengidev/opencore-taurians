import { ProjectLeftPanel } from "../../../project";

export function ShellLeftPanel() {
  return (
    <aside
      aria-label="left panel"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background"
    >
      <ProjectLeftPanel />
    </aside>
  );
}
