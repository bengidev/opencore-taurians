import { Button } from "@/components/ui/button";
import { useShellStore, type ShellMainCard } from "../state/shellStore";
import { ShellPanelToggle } from "./shellPanelToggle";
import { ShellSettingsButton } from "./shellSettingsButton";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

const MAIN_CARD_LABELS: Record<ShellMainCard, string> = {
  chat: "Chat",
  terminal: "Terminal",
  editor: "Editor",
};

export function ShellMainCardTabs() {
  const activeMainCard = useShellStore((s) => s.activeMainCard);
  const setActiveMainCard = useShellStore((s) => s.setActiveMainCard);
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);

  return (
    <header className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 bg-background px-2">
      <div className="flex min-w-0 items-center gap-1">
        {!leftVisible ? (
          <>
            <ShellPanelToggle side="left" />
            <ShellSettingsButton />
          </>
        ) : null}
      </div>
      <div
        role="tablist"
        aria-label="Main cards"
        className="flex items-center gap-1"
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
      <div className="flex min-w-0 items-center justify-end gap-1">
        {!rightVisible ? <ShellPanelToggle side="right" /> : null}
      </div>
    </header>
  );
}
