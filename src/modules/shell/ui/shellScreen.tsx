import { useShellStore } from "../state/shellStore";
import { ShellBottomPanel } from "./panels/shellBottomPanel";
import { ShellLeftPanel } from "./panels/shellLeftPanel";
import { ShellMainPanel } from "./panels/shellMainPanel";
import { ShellRightPanel } from "./panels/shellRightPanel";
import { ShellModeBar } from "./shellModeBar";

export function ShellScreen() {
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] bg-background text-foreground">
      <ShellModeBar />
      <div className="grid min-h-0 grid-cols-[auto_1fr_auto]">
        {leftVisible ? <ShellLeftPanel /> : null}
        <ShellMainPanel />
        {rightVisible ? <ShellRightPanel /> : null}
      </div>
      <ShellBottomPanel />
    </div>
  );
}
