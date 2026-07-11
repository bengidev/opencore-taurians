import { useShellStore } from "../../state/shellStore";
import { ShellPanelToggle } from "../shellPanelToggle";

export function ShellLeftPanelHeader() {
  const leftVisible = useShellStore((s) => s.leftVisible);
  if (!leftVisible) return null;

  return (
    <header className="flex h-9 shrink-0 items-center border-b border-border px-2">
      <ShellPanelToggle side="left" />
    </header>
  );
}
