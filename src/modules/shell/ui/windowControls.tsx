import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { USE_CUSTOM_WINDOW_CONTROLS, type PlatformTag } from "@/lib/platform";

type WindowControlsProps = {
  tag: PlatformTag;
};

/** Custom min/max/close cluster for non-macOS. Renders nothing on macOS. */
export function WindowControls({ tag }: WindowControlsProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!USE_CUSTOM_WINDOW_CONTROLS(tag)) return;
    const w = getCurrentWindow();
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void w.isMaximized().then((value) => {
      if (!cancelled) setMaximized(value);
    });
    void w
      .onResized(() => {
        void w.isMaximized().then((value) => {
          if (!cancelled) setMaximized(value);
        });
      })
      .then((un) => {
        if (cancelled) {
          un(); // onResized resolved after unmount: release the listener.
        } else {
          unlisten = un;
        }
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [tag]);

  if (!USE_CUSTOM_WINDOW_CONTROLS(tag)) return null;

  const w = getCurrentWindow();

  return (
    <div className="flex h-full shrink-0 items-center gap-0.5 pr-1">
      <CtlButton ariaLabel="Minimize" onClick={() => void w.minimize()}>
        <Minus className="size-3" />
      </CtlButton>
      <CtlButton
        ariaLabel={maximized ? "Restore" : "Maximize"}
        onClick={() => void w.toggleMaximize()}
      >
        {maximized ? <Copy className="size-3" /> : <Square className="size-3" />}
      </CtlButton>
      <CtlButton
        ariaLabel="Close"
        onClick={() => void w.close()}
        danger
      >
        <X className="size-3.5" />
      </CtlButton>
    </div>
  );
}

function CtlButton({
  ariaLabel,
  onClick,
  children,
  danger,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors",
        danger
          ? "hover:bg-destructive/15 hover:text-destructive"
          : "hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
