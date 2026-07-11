import { Settings } from "lucide-react";
import { PanelToolButton } from "../../project";
import { useShellStore } from "../state/shellStore";

export function ShellSettingsButton() {
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen);

  return (
    <PanelToolButton label="Settings" onClick={() => setSettingsOpen(true)}>
      <Settings className="size-3.5" />
    </PanelToolButton>
  );
}
