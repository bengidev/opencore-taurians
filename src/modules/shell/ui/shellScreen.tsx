import { useShellStore } from "../state/shellStore";
import { ShellBottomPanel } from "./panels/shellBottomPanel";
import { ShellLeftPanel } from "./panels/shellLeftPanel";
import { ShellMainPanel } from "./panels/shellMainPanel";
import { ShellRightPanel } from "./panels/shellRightPanel";
import { ShellModeBar } from "./shellModeBar";

export function ShellScreen() {
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);
  const leftPanelWidth = useShellStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useShellStore((s) => s.rightPanelWidth);

  const columns = [
    leftVisible ? `${leftPanelWidth}px` : null,
    "minmax(0, 1fr)",
    rightVisible ? `${rightPanelWidth}px` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <ShellModeBar />
      <div className="grid min-h-0" style={{ gridTemplateColumns: columns }}>
        {leftVisible ? <ShellLeftPanel /> : null}
        <ShellMainPanel />
        {rightVisible ? <ShellRightPanel /> : null}
      </div>
      <ShellBottomPanel />
    </div>
  );
}
