import { useEffect, useRef, useState } from "react";

export interface ProjectTrunkRenameInputProps {
  initialTitle: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}

export function ProjectTrunkRenameInput({
  initialTitle,
  onCommit,
  onCancel,
}: ProjectTrunkRenameInputProps) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label="Rename trunk"
      className="min-w-0 flex-1 rounded-[4px] border border-border bg-background px-1.5 py-0 font-mono text-[11px] tracking-[0.08em] text-foreground outline-none transition-[border-color,box-shadow] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] focus-visible:border-foreground/30 focus-visible:ring-1 focus-visible:ring-ring/40"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => onCancel()}
    />
  );
}
