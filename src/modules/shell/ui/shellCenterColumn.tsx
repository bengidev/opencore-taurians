import { ShellBottomPanel } from "./panels/shellBottomPanel";
import { ShellMainPanel } from "./panels/shellMainPanel";
import { ShellMainCardTabs } from "./shellMainCardTabs";

export function ShellCenterColumn() {
  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_1fr_auto]">
      <ShellMainCardTabs />
      <ShellMainPanel />
      <ShellBottomPanel />
    </div>
  );
}
