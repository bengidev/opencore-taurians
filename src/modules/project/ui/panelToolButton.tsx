import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PanelTooltip } from "./panelTooltip";

type PanelToolButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "children"
> & {
  label: string;
  children: ReactNode;
};

/** Compact icon control with a minimal rounded tooltip for panel chrome. */
export function PanelToolButton({
  label,
  children,
  className,
  ...props
}: PanelToolButtonProps) {
  return (
    <PanelTooltip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        className={className ?? "shrink-0 text-muted-foreground"}
        {...props}
      >
        {children}
      </Button>
    </PanelTooltip>
  );
}
