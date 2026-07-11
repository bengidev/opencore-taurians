import { useShellStore } from "../../state/shellStore";
import { ShellPanelToggle } from "../shellPanelToggle";
import { ShellSettingsButton } from "../shellSettingsButton";

export function ShellLeftPanelHeader() {
  const leftVisible = useShellStore((s) => s.leftVisible);
  if (!leftVisible) return null;

  return (
    <header className="flex h-9 shrink-0 items-center gap-1 bg-background px-2">
      <ShellPanelToggle side="left" />
      <ShellSettingsButton />
    </header>
  );
}
