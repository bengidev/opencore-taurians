import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  distributeShellColumnWidths,
  SHELL_LAYOUT_REFERENCE_WIDTH,
} from "../state/shellColumnLayout";
import { useShellStore } from "../state/shellStore";
import { ShellLeftPanel } from "./panels/shellLeftPanel";
import { ShellLeftPanelHeader } from "./panels/shellLeftPanelHeader";
import { ShellRightPanel } from "./panels/shellRightPanel";
import { ShellRightPanelHeader } from "./panels/shellRightPanelHeader";
import { ShellCenterColumn } from "./shellCenterColumn";
import { ShellMainCardTabs } from "./shellMainCardTabs";
import { ShellPanelResizeHandle } from "./shellPanelResizeHandle";
import { ShellPanelSlot } from "./shellPanelSlot";
import { ShellSettingsPage } from "./shellSettingsPage";
import { SHELL_EASE_OUT, SHELL_HIDE_MS, SHELL_SHOW_MS } from "./shellMotion";

const RESIZE_HANDLE_WIDTH = 8;

function ShellPanelResizeGutter({
  visible,
  edge,
  ariaLabel,
  getWidth,
  onResize,
  style,
}: {
  visible: boolean;
  edge: "start" | "end";
  ariaLabel: string;
  getWidth: () => number;
  onResize: (width: number) => void;
  style: CSSProperties;
}) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const timeout = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-0 bottom-0 z-20 motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{
        ...style,
        width: RESIZE_HANDLE_WIDTH,
        transitionProperty: "opacity",
        transitionDuration: visible ? `${SHELL_SHOW_MS}ms` : `${SHELL_HIDE_MS}ms`,
        transitionTimingFunction: SHELL_EASE_OUT,
      }}
    >
      <ShellPanelResizeHandle
        edge={edge}
        ariaLabel={ariaLabel}
        getWidth={getWidth}
        onResize={onResize}
        className="pointer-events-auto relative h-full w-full"
        style={{ left: 0, right: 0 }}
      />
    </div>
  );
}

export function ShellScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(
    SHELL_LAYOUT_REFERENCE_WIDTH,
  );
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);
  const leftPanelWidth = useShellStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useShellStore((s) => s.rightPanelWidth);
  const settingsOpen = useShellStore((s) => s.settingsOpen);
  const setLeftPanelWidth = useShellStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useShellStore((s) => s.setRightPanelWidth);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.round(
        entry.contentRect.width || entry.target.clientWidth,
      );
      setAvailableWidth(width);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const columns = distributeShellColumnWidths({
    available: availableWidth,
    leftPreferred: leftPanelWidth,
    rightPreferred: rightPanelWidth,
    leftVisible,
    rightVisible,
  });

  return (
    <TooltipProvider delay={0}>
      <div
        ref={rootRef}
        data-shell-available-width={String(availableWidth)}
        className="relative flex h-full min-h-0 flex-col bg-background text-foreground"
      >
        <div className="flex shrink-0 divide-x divide-border border-y border-border bg-background">
          <ShellPanelSlot side="left" visible={leftVisible} width={columns.left}>
            <ShellLeftPanelHeader />
          </ShellPanelSlot>
          <ShellMainCardTabs />
          <ShellPanelSlot side="right" visible={rightVisible} width={columns.right}>
            <ShellRightPanelHeader />
          </ShellPanelSlot>
        </div>
        <div className="flex min-h-0 flex-1 divide-x divide-border bg-background">
          <ShellPanelSlot side="left" visible={leftVisible} width={columns.left}>
            <ShellLeftPanel />
          </ShellPanelSlot>
          <ShellCenterColumn />
          <ShellPanelSlot side="right" visible={rightVisible} width={columns.right}>
            <ShellRightPanel />
          </ShellPanelSlot>
        </div>
        <ShellPanelResizeGutter
          visible={leftVisible}
          edge="end"
          ariaLabel="Resize left panel"
          getWidth={() => useShellStore.getState().leftPanelWidth}
          onResize={setLeftPanelWidth}
          style={{ left: columns.left - RESIZE_HANDLE_WIDTH / 2 }}
        />
        <ShellPanelResizeGutter
          visible={rightVisible}
          edge="start"
          ariaLabel="Resize right panel"
          getWidth={() => useShellStore.getState().rightPanelWidth}
          onResize={setRightPanelWidth}
          style={{ right: columns.right - RESIZE_HANDLE_WIDTH / 2 }}
        />
        <ShellSettingsPage open={settingsOpen} />
      </div>
    </TooltipProvider>
  );
}
