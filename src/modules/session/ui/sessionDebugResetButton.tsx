import { Button } from "@/components/ui/button";

export interface SessionDebugResetButtonProps {
  onReset: () => void | Promise<void>;
}

export function SessionDebugResetButton({
  onReset,
}: SessionDebugResetButtonProps) {
  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-[100]">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="pointer-events-auto font-mono text-[11px] uppercase tracking-[0.08em]"
        aria-label="Reset persisted data"
        onClick={() => void onReset()}
      >
        Reset persisted data
      </Button>
    </div>
  );
}
