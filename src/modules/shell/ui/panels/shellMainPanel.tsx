import { useShellStore, type ShellMainCard } from "../../state/shellStore";

const MAIN_CARDS = ["chat", "terminal", "editor"] as const satisfies readonly ShellMainCard[];

export function ShellMainPanel() {
  const activeMainCard = useShellStore((s) => s.activeMainCard);

  return (
    <main className="relative min-h-0 flex-1 border-x border-border bg-background">
      {MAIN_CARDS.map((card) => (
        <section
          key={card}
          hidden={activeMainCard !== card}
          aria-hidden={activeMainCard !== card}
          className="absolute inset-0 p-3"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {card}
          </p>
          <input
            aria-label={`${card}-dummy-note`}
            className="mt-2 w-full rounded-[6px] border border-border bg-transparent px-2 py-1 text-sm"
          />
        </section>
      ))}
    </main>
  );
}
