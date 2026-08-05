import type { ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PanelTooltipProps = {
  label: string;
  /**
   * Tooltip side relative to the trigger. Defaults to "top". Use "bottom" for
   * triggers in the window chrome row so the popup doesn't collide with the
   * macOS overlay title bar (traffic lights).
   */
  side?: "top" | "bottom" | "left" | "right";
  children: ReactElement;
};

/** Shared minimal tooltip styling for project panel labels and controls. */
export function PanelTooltip({ label, side = "top", children }: PanelTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
