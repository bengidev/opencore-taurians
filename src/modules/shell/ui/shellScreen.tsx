import { useEffect, useState, type CSSProperties } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

const RESIZE_HANDLE_WIDTH = 8;
const SHELL_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

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
        transitionDuration: visible ? "260ms" : "180ms",
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
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);
  const leftPanelWidth = useShellStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useShellStore((s) => s.rightPanelWidth);
  const settingsOpen = useShellStore((s) => s.settingsOpen);
  const setLeftPanelWidth = useShellStore((s) => s.setLeftPanelWidth);
  const setRightPanelWidth = useShellStore((s) => s.setRightPanelWidth);

  return (
    <TooltipProvider delay={400}>
      <div className="relative flex h-dvh min-h-0 flex-col bg-background text-foreground">
        <div className="flex shrink-0 divide-x divide-border border-y border-border bg-background">
          <ShellPanelSlot side="left" visible={leftVisible} width={leftPanelWidth}>
            <ShellLeftPanelHeader />
          </ShellPanelSlot>
          <ShellMainCardTabs />
          <ShellPanelSlot side="right" visible={rightVisible} width={rightPanelWidth}>
            <ShellRightPanelHeader />
          </ShellPanelSlot>
        </div>
        <div className="flex min-h-0 flex-1 divide-x divide-border bg-background">
          <ShellPanelSlot side="left" visible={leftVisible} width={leftPanelWidth}>
            <ShellLeftPanel />
          </ShellPanelSlot>
          <ShellCenterColumn />
          <ShellPanelSlot side="right" visible={rightVisible} width={rightPanelWidth}>
            <ShellRightPanel />
          </ShellPanelSlot>
        </div>
        <ShellPanelResizeGutter
          visible={leftVisible}
          edge="end"
          ariaLabel="Resize left panel"
          getWidth={() => useShellStore.getState().leftPanelWidth}
          onResize={setLeftPanelWidth}
          style={{ left: leftPanelWidth - RESIZE_HANDLE_WIDTH / 2 }}
        />
        <ShellPanelResizeGutter
          visible={rightVisible}
          edge="start"
          ariaLabel="Resize right panel"
          getWidth={() => useShellStore.getState().rightPanelWidth}
          onResize={setRightPanelWidth}
          style={{ right: rightPanelWidth - RESIZE_HANDLE_WIDTH / 2 }}
        />
        <ShellSettingsPage open={settingsOpen} />
      </div>
    </TooltipProvider>
  );
}
