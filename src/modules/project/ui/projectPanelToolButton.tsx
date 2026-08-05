import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PanelTooltip } from "./projectPanelTooltip";

type PanelToolButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "children"
> & {
  label: string;
  children: ReactNode;
  /** Tooltip side; see PanelTooltip. Default "top". */
  tooltipSide?: "top" | "bottom" | "left" | "right";
};

/** Compact icon control with a minimal rounded tooltip for panel chrome. */
export function PanelToolButton({
  label,
  children,
  className,
  tooltipSide,
  ...props
}: PanelToolButtonProps) {
  return (
    <PanelTooltip label={label} side={tooltipSide}>
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
