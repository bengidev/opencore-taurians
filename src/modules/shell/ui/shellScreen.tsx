import { useShellStore } from "../state/shellStore";
import { ShellCenterColumn } from "./shellCenterColumn";
import { ShellLeftPanel } from "./panels/shellLeftPanel";
import { ShellPanelSlot } from "./shellPanelSlot";
import { ShellRightPanel } from "./panels/shellRightPanel";

export function ShellScreen() {
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);
  const leftPanelWidth = useShellStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useShellStore((s) => s.rightPanelWidth);

  return (
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <ShellPanelSlot visible={leftVisible} width={leftPanelWidth}>
        <ShellLeftPanel />
      </ShellPanelSlot>
      <ShellCenterColumn />
      <ShellPanelSlot visible={rightVisible} width={rightPanelWidth}>
        <ShellRightPanel />
      </ShellPanelSlot>
    </div>
  );
}
