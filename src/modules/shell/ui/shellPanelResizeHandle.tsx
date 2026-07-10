import { useRef } from "react";
import { cn } from "@/lib/utils";
import { clampShellPanelWidth } from "../state/shellPanelSizing";

interface DragState {
  pointerId: number;
  startX: number;
  startWidth: number;
}

export interface ShellPanelResizeHandleProps {
  edge: "start" | "end";
  ariaLabel: string;
  getWidth: () => number;
  onResize: (width: number) => void;
}

export function ShellPanelResizeHandle({
  edge,
  ariaLabel,
  getWidth,
  onResize,
}: ShellPanelResizeHandleProps) {
  const dragRef = useRef<DragState | null>(null);

  const finishPointerInteraction = (
    target: HTMLElement,
    pointerId: number,
  ): void => {
    target.releasePointerCapture?.(pointerId);
    dragRef.current = null;
    document.body.style.removeProperty("cursor");
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      className={cn(
        "absolute top-0 bottom-0 z-10 w-2 touch-none",
        edge === "end"
          ? "-right-1 cursor-col-resize"
          : "-left-1 cursor-col-resize",
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: getWidth(),
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        document.body.style.cursor = "col-resize";
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const delta = event.clientX - drag.startX;
        const nextWidth =
          edge === "end"
            ? drag.startWidth + delta
            : drag.startWidth - delta;
        onResize(clampShellPanelWidth(nextWidth));
      }}
      onPointerUp={(event) => {
        finishPointerInteraction(event.currentTarget, event.pointerId);
      }}
      onPointerCancel={(event) => {
        finishPointerInteraction(event.currentTarget, event.pointerId);
      }}
    />
  );
}
