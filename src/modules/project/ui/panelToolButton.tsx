import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PanelToolButtonProps = Omit<
  ComponentProps<typeof Button>,
  "variant" | "size" | "children"
> & {
  label: string;
  children: ReactNode;
};

/** Icon control with a minimal rounded tooltip for the project left panel. */
export function PanelToolButton({
  label,
  children,
  className,
  ...props
}: PanelToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className={className ?? "shrink-0 text-muted-foreground"}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
