import { Settings } from "lucide-react";
import { PanelToolButton } from "../../../project";

export function ShellBottomPanel() {
  return (
    <footer className="flex h-9 shrink-0 items-center border-t border-border bg-background px-2">
      <PanelToolButton label="Settings" onClick={() => {}}>
        <Settings className="size-3.5" />
      </PanelToolButton>
    </footer>
  );
}
