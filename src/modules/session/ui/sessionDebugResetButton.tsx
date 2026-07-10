import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const DRAG_THRESHOLD_PX = 5;
const VIEWPORT_MARGIN_PX = 12;

export interface SessionDebugResetButtonProps {
  onReset: () => void | Promise<void>;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  dragging: boolean;
}

function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

function lockDocumentSelection(): void {
  const { documentElement: root, body } = document;
  root.style.userSelect = "none";
  body.style.userSelect = "none";
  root.style.webkitUserSelect = "none";
  body.style.webkitUserSelect = "none";
  clearTextSelection();
}

function unlockDocumentSelection(): void {
  const { documentElement: root, body } = document;
  root.style.removeProperty("user-select");
  body.style.removeProperty("user-select");
  root.style.removeProperty("-webkit-user-select");
  body.style.removeProperty("-webkit-user-select");
}

function clampToViewport(
  el: HTMLElement,
  left: number,
  top: number,
): { left: number; top: number } {
  const maxLeft = Math.max(
    VIEWPORT_MARGIN_PX,
    window.innerWidth - el.offsetWidth - VIEWPORT_MARGIN_PX,
  );
  const maxTop = Math.max(
    VIEWPORT_MARGIN_PX,
    window.innerHeight - el.offsetHeight - VIEWPORT_MARGIN_PX,
  );

  return {
    left: Math.min(Math.max(VIEWPORT_MARGIN_PX, left), maxLeft),
    top: Math.min(Math.max(VIEWPORT_MARGIN_PX, top), maxTop),
  };
}

export function SessionDebugResetButton({
  onReset,
}: SessionDebugResetButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const selectionLockedRef = useRef(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = useCallback((left: number, top: number) => {
    const el = containerRef.current;
    if (!el) return { left, top };
    return clampToViewport(el, left, top);
  }, []);

  useEffect(() => {
    return () => {
      if (selectionLockedRef.current) {
        unlockDocumentSelection();
        selectionLockedRef.current = false;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (position === null) return;

    const reclamp = () => {
      const el = containerRef.current;
      if (!el) return;

      setPosition((current) => {
        if (!current) return current;
        const next = clampToViewport(el, current.left, current.top);
        if (next.left === current.left && next.top === current.top) {
          return current;
        }
        return next;
      });
    };

    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [position]);

  const readPosition = () => {
    const el = containerRef.current;
    if (!el) return { left: 0, top: 0 };

    if (position) return position;

    const rect = el.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  };

  const beginPointerInteraction = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    clearTextSelection();

    if (!selectionLockedRef.current) {
      lockDocumentSelection();
      selectionLockedRef.current = true;
    }

    const { left, top } = readPosition();
    if (!position) {
      setPosition({ left, top });
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: left,
      originTop: top,
      dragging: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.dragging) {
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      suppressClickRef.current = true;
      setIsDragging(true);
      clearTextSelection();
    }

    setPosition(
      clampPosition(drag.originLeft + deltaX, drag.originTop + deltaY),
    );
  };

  const finishPointerInteraction = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const wasDragging = drag.dragging;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    dragRef.current = null;
    setIsDragging(false);
    clearTextSelection();

    if (selectionLockedRef.current) {
      unlockDocumentSelection();
      selectionLockedRef.current = false;
    }

    if (wasDragging) {
      event.preventDefault();
      suppressClickRef.current = false;
      return;
    }

    void onReset();
  };

  return (
    <div
      ref={containerRef}
      className={[
        "fixed z-[100] touch-none select-none [-webkit-user-drag:none]",
        position ? "" : "right-3 bottom-3",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      ].join(" ")}
      style={
        position
          ? { left: position.left, top: position.top, userSelect: "none" }
          : { userSelect: "none" }
      }
      onPointerDown={beginPointerInteraction}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerInteraction}
      onPointerCancel={finishPointerInteraction}
      onDragStart={(event) => event.preventDefault()}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        draggable={false}
        className={[
          "cursor-inherit select-none [-webkit-user-drag:none]",
          "font-mono text-[11px] uppercase tracking-[0.08em]",
          isDragging ? "active:scale-100" : "",
        ].join(" ")}
        aria-label="Reset persisted data"
        title="Drag to reposition"
      >
        Reset persisted data
      </Button>
    </div>
  );
}
