import { Button } from "@/components/ui/button";
import { useShellStore, type ShellMainCard } from "../state/shellStore";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

export function ShellModeBar() {
  const activeMainCard = useShellStore((s) => s.activeMainCard);
  const setActiveMainCard = useShellStore((s) => s.setActiveMainCard);
  const toggleLeft = useShellStore((s) => s.toggleLeft);
  const toggleRight = useShellStore((s) => s.toggleRight);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-background px-3 py-2">
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
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-mono text-[11px] uppercase tracking-[0.08em]"
          onClick={toggleLeft}
        >
          Toggle left
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-mono text-[11px] uppercase tracking-[0.08em]"
          onClick={toggleRight}
        >
          Toggle right
        </Button>
      </div>
    </header>
  );
}
