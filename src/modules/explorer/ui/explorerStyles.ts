import { cn } from "@/lib/utils";

const explorerRowMotion =
  "transition-[background-color,color,transform] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] motion-reduce:transition-none active:scale-[0.98]";

const explorerRowHover =
  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/60 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground";

export function explorerRowButtonClassName(selected: boolean): string {
  return cn(
    "flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-[4px] px-1.5 py-1 text-left font-mono text-[11px] tracking-[0.08em]",
    explorerRowMotion,
    explorerRowHover,
    selected ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_var(--border)]" : "text-muted-foreground",
  );
}

export function explorerChevronClassName(expanded: boolean): string {
  return cn(
    "size-3 shrink-0 text-muted-foreground motion-reduce:transition-none",
    "transition-transform ease-[var(--ease-out)]",
    expanded
      ? "rotate-90 duration-[var(--duration-ui-panel-show)]"
      : "duration-[var(--duration-ui-panel-hide)]",
  );
}

export function explorerTreeChildrenGridClassName(expanded: boolean): string {
  return cn(
    "grid motion-reduce:grid-rows-[1fr] motion-reduce:opacity-100",
    expanded
      ? "grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-[var(--duration-ui-panel-show)] ease-[var(--ease-out)]"
      : "grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-[var(--duration-ui-panel-hide)] ease-[var(--ease-out)]",
  );
}

export const explorerTreeChildrenInnerClassName = "min-h-0 overflow-hidden";

export const explorerIconClassName = "size-3 shrink-0 opacity-80";

export const explorerContextMenuClassName =
  "min-w-40 font-mono text-[11px] tracking-[0.08em]";

export const explorerPanelDismissClassName = cn(
  "shrink-0 rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground",
  explorerRowMotion,
  explorerRowHover,
);
