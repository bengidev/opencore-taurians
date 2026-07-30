import { useShellStore } from "../../state/shellStore";
import { ShellPanelToggle } from "../shellPanelToggle";
import { ShellRightPanelFeatureControls } from "../shellRightPanelFeatureControls";

export function ShellRightPanelHeader() {
  const rightVisible = useShellStore((s) => s.rightVisible);
  if (!rightVisible) return null;

  return (
    <header className="flex h-9 shrink-0 items-center bg-background px-2">
      <ShellRightPanelFeatureControls />
      <span className="flex-1" />
      <ShellPanelToggle side="right" />
    </header>
  );
}
