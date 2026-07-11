import { Settings } from "lucide-react";
import { useState } from "react";
import { PanelToolButton } from "../../../project";
import { ShellSettingsSheet } from "../shellSettingsSheet";

export function ShellBottomPanel() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <footer className="flex h-9 shrink-0 items-center border-t border-border bg-background px-2">
        <PanelToolButton label="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings className="size-3.5" />
        </PanelToolButton>
      </footer>
      <ShellSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
