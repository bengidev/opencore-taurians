import { useEffect, useState, type ReactNode } from "react";

import {
  SHELL_EASE_DRAWER,
  SHELL_EASE_OUT,
  SHELL_HIDE_MS,
  SHELL_SHOW_MS,
  prefersReducedMotion,
  scheduleReveal,
} from "./shellMotion";

type ShellPanelSide = "left" | "right";

type ShellPanelSlotProps = {
  visible: boolean;
  width: number;
  side: ShellPanelSide;
  children: ReactNode;
};

const CONTENT_OFFSET_PX = 12;

export function ShellPanelSlot({
  visible,
  width,
  side,
  children,
}: ShellPanelSlotProps) {
  const [mounted, setMounted] = useState(visible);
  const [revealed, setRevealed] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduceMotion) {
        setRevealed(true);
        return;
      }
      setRevealed(false);
      scheduleReveal(setRevealed);
      return;
    }

    setRevealed(false);
    if (reduceMotion) {
      setMounted(false);
    }
  }, [visible, reduceMotion]);

  if (!mounted) return null;

  const displayWidth = visible ? width : 0;
  const outerDurationMs = visible ? SHELL_SHOW_MS : SHELL_HIDE_MS;
  const outerEase = visible ? SHELL_EASE_OUT : SHELL_EASE_DRAWER;
  const contentOffset =
    side === "left" ? -CONTENT_OFFSET_PX : CONTENT_OFFSET_PX;
  const transformOrigin = side === "left" ? "left center" : "right center";

  return (
    <div
      data-shell-panel-slot=""
      data-shell-panel-side={side}
      className="min-h-0 shrink-0 overflow-hidden motion-reduce:transition-none"
      style={{
        width: displayWidth,
        transitionProperty: reduceMotion ? "none" : "width",
        transitionDuration: reduceMotion ? "0ms" : `${outerDurationMs}ms`,
        transitionTimingFunction: outerEase,
      }}
      onTransitionEnd={(event) => {
        if (event.propertyName === "width" && !visible) {
          setMounted(false);
        }
      }}
    >
      <div
        className="h-full motion-reduce:transition-none motion-reduce:blur-none motion-reduce:opacity-100"
        style={{
          width,
          opacity: revealed || reduceMotion ? 1 : 0,
          filter: revealed || reduceMotion ? "blur(0px)" : "blur(2px)",
          transform:
            revealed || reduceMotion
              ? "scaleX(1) translateX(0px)"
              : `scaleX(0) translateX(${contentOffset}px)`,
          transformOrigin,
          transitionProperty: reduceMotion ? "none" : "transform, opacity, filter",
          transitionDuration: reduceMotion
            ? "0ms"
            : `${outerDurationMs}ms`,
          transitionTimingFunction: outerEase,
        }}
      >
        {children}
      </div>
    </div>
  );
}
