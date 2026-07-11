import type { ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type PanelTooltipProps = {
  label: string;
  children: ReactElement;
};

/** Shared minimal tooltip styling for project panel labels and controls. */
export function PanelTooltip({ label, children }: PanelTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
