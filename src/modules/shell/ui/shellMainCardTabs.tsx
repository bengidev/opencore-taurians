import { Button } from "@/components/ui/button";
import { useShellStore, type ShellMainCard } from "../state/shellStore";
import { ShellPanelToggle } from "./shellPanelToggle";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

export function ShellMainCardTabs() {
  const activeMainCard = useShellStore((s) => s.activeMainCard);
  const setActiveMainCard = useShellStore((s) => s.setActiveMainCard);
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);

  return (
    <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2">
      <div className="flex min-w-0 items-center gap-1">
        {!leftVisible ? <ShellPanelToggle side="left" /> : null}
      </div>
      <div className="flex items-center gap-1">
        {MAIN_CARDS.map((card) => (
          <Button
            key={card}
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={activeMainCard === card}
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            onClick={() => setActiveMainCard(card)}
          >
            {card}
          </Button>
        ))}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1">
        {!rightVisible ? <ShellPanelToggle side="right" /> : null}
      </div>
    </header>
  );
}
