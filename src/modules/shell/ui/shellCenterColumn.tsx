import { useShellStore } from "../state/shellStore";
import { ShellBottomPanel } from "./panels/shellBottomPanel";
import { ShellMainPanel } from "./panels/shellMainPanel";

export function ShellCenterColumn() {
  const bottomVisible = useShellStore((s) => s.bottomVisible);

  return (
    <div
      className={
        bottomVisible
          ? "grid min-h-0 min-w-0 flex-1 grid-rows-[1fr_auto]"
          : "grid min-h-0 min-w-0 flex-1 grid-rows-[1fr]"
      }
    >
      <ShellMainPanel />
      {bottomVisible ? <ShellBottomPanel /> : null}
    </div>
  );
}
