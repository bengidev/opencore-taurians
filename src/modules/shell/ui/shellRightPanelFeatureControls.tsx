import { FolderTree, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_CONTROL_SUITE_RELEASE_ENABLED } from "../../source-control/domain/sourceControlFeatureAvailability";
import { useProjectStore } from "../../project/state/projectStore";
import type { RightPanelFeature } from "../../project/domain/projectTypes";
import { PanelToolButton } from "../../project/ui/panelToolButton";
import { useShellStore } from "../state/shellStore";

export interface ShellRightPanelFeatureControlsProps {
  enabled?: boolean;
}

const FEATURES: Array<{
  id: RightPanelFeature;
  label: string;
  Icon: typeof FolderTree;
}> = [
  { id: "files", label: "Files", Icon: FolderTree },
  { id: "git", label: "Source control", Icon: GitBranch },
];

export function ShellRightPanelFeatureControls({
  enabled = SOURCE_CONTROL_SUITE_RELEASE_ENABLED,
}: ShellRightPanelFeatureControlsProps) {
  const activeTrunkId = useProjectStore((state) => state.activeTrunkId);
  const feature = useProjectStore((state) =>
    state.trunks.find((trunk) => trunk.id === state.activeTrunkId)?.restore
      .rightPanelFeature ?? "files",
  );

  if (!enabled) return null;

  const select = (next: RightPanelFeature) => {
    if (!activeTrunkId) return;
    useProjectStore.getState().setTrunkRightPanelFeature(activeTrunkId, next);
    useShellStore.getState().setRightVisible(true);
  };

  return (
    <div
      role="group"
      aria-label="Right panel feature"
      className="flex items-center gap-1"
    >
      {FEATURES.map(({ id, label, Icon }) => {
        const selected = feature === id;
        return (
          <PanelToolButton
            key={id}
            label={label}
            aria-pressed={selected}
            disabled={!activeTrunkId}
            className={cn(
              "shrink-0 text-muted-foreground",
              selected && "bg-muted text-foreground",
            )}
            onClick={() => select(id)}
          >
            <Icon className="size-3" aria-hidden />
          </PanelToolButton>
        );
      })}
    </div>
  );
}
