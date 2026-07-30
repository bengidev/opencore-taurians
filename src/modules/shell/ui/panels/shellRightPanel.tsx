import { ExplorerPanel } from "../../../explorer";
import { GIT_SUITE_RELEASE_ENABLED } from "../../../git/domain/gitFeatureAvailability";
import { GitPanel } from "../../../git/ui/GitPanel";
import { useProjectStore } from "../../../project/state/projectStore";

export interface ShellRightPanelProps {
  gitEnabled?: boolean;
}

export function ShellRightPanel({
  gitEnabled = GIT_SUITE_RELEASE_ENABLED,
}: ShellRightPanelProps) {
  const feature = useProjectStore((state) =>
    state.trunks.find((trunk) => trunk.id === state.activeTrunkId)?.restore
      .rightPanelFeature ?? "files",
  );
  const showGit = gitEnabled && feature === "git";

  return (
    <aside
      aria-label="right panel"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background"
    >
      {showGit ? <GitPanel /> : <ExplorerPanel />}
    </aside>
  );
}
