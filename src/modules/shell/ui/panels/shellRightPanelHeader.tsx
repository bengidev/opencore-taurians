import { useShellStore } from "../../state/shellStore";
import { ShellPanelToggle } from "../shellPanelToggle";

export function ShellRightPanelHeader() {
  const rightVisible = useShellStore((s) => s.rightVisible);
  if (!rightVisible) return null;

  return (
    <header className="flex h-9 shrink-0 items-center justify-end border-b border-border px-2">
      <ShellPanelToggle side="right" />
    </header>
  );
}
