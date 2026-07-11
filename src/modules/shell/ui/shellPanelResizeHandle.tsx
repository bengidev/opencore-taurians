import { useRef, type CSSProperties } from "react";
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
  className?: string;
  style?: CSSProperties;
}

export function ShellPanelResizeHandle({
  edge,
  ariaLabel,
  getWidth,
  onResize,
  className,
  style,
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

  const usesShellGutter = style?.left !== undefined || style?.right !== undefined;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      className={cn(
        usesShellGutter
          ? "relative z-20 h-full w-full touch-none cursor-col-resize"
          : "absolute top-0 bottom-0 z-20 w-2 touch-none cursor-col-resize",
        !usesShellGutter && edge === "end" ? "-right-1" : null,
        !usesShellGutter && edge === "start" ? "-left-1" : null,
        className,
      )}
      style={style}
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
