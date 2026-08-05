import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/lib/platform";
import { useShellStore, type ShellMainCard } from "../state/shellStore";
import { ShellPanelToggle } from "./shellPanelToggle";
import { ShellSettingsButton } from "./shellSettingsButton";
import { ShellRightPanelFeatureControls } from "./shellRightPanelFeatureControls";
import { WindowControls } from "./windowControls";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

const MAIN_CARD_LABELS: Record<ShellMainCard, string> = {
  chat: "Chat",
  terminal: "Terminal",
  editor: "Editor",
};

export function ShellWindowChrome() {
  const platform = usePlatform();
  const isMac = platform === "macos";
  const activeMainCard = useShellStore((s) => s.activeMainCard);
  const setActiveMainCard = useShellStore((s) => s.setActiveMainCard);

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background select-none",
        isMac ? "pl-20 pr-2" : "pl-2 pr-0",
      )}
    >
      <div className="flex shrink-0 items-center gap-1">
        <ShellPanelToggle side="left" />
        <ShellSettingsButton />
      </div>

      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center justify-center">
        <div
          role="tablist"
          aria-label="Main cards"
          className="flex w-max items-center gap-1"
        >
          {MAIN_CARDS.map((card) => {
            const selected = activeMainCard === card;
            return (
              <Button
                key={card}
                type="button"
                role="tab"
                variant="outline"
                size="sm"
                aria-selected={selected}
                className="font-mono text-[11px] uppercase tracking-[0.08em] aria-selected:border-foreground aria-selected:bg-muted aria-selected:text-foreground"
                onClick={() => setActiveMainCard(card)}
              >
                {MAIN_CARD_LABELS[card]}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ShellRightPanelFeatureControls />
        <ShellPanelToggle side="right" />
        {!isMac && (
          <>
            <span className="ml-1 h-5 w-px shrink-0 bg-border/60" />
            <WindowControls tag={platform} />
          </>
        )}
      </div>
    </div>
  );
}
