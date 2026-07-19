import { useEffect, useRef, useState } from "react";
import { useExplorerStore } from "../state/explorerStore";

export interface ExplorerRenameInputProps {
  initialName: string;
}

export function ExplorerRenameInput({ initialName }: ExplorerRenameInputProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const commitRename = useExplorerStore((s) => s.commitRename);
  const cancelRename = useExplorerStore((s) => s.cancelRename);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label="Rename"
      className="min-w-0 flex-1 rounded-sm border border-border bg-background px-1 py-0 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commitRename(value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelRename();
        }
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}
