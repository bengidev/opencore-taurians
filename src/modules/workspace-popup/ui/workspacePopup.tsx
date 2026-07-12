import { XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "../../../../design-system/motion";
import { useTheme } from "../../onboarding";
import { projectOpenFolder } from "../../project/state/projectActivation";
import {
  createTauriFolderPicker,
  type FolderPicker,
} from "../infrastructure/workspaceFolderPicker";

export interface WorkspacePopupProps {
  folderPicker?: FolderPicker;
  onClose?: () => void;
  onWorkspaceOpened?: () => void;
}

const GET_STARTED_ACTIONS = [
  { id: "new-file", label: "New file", enabled: false },
  { id: "open-project", label: "Open project", enabled: true },
  { id: "clone-repository", label: "Clone repository", enabled: false },
  {
    id: "open-command-palette",
    label: "Open command palette",
    enabled: false,
  },
] as const;

export function WorkspacePopup({
  folderPicker = createTauriFolderPicker(),
  onClose,
  onWorkspaceOpened,
}: WorkspacePopupProps) {
  const { mode } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRevealed(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const requestClose = useCallback(() => {
    if (!onClose || exiting) return;
    if (reduceMotion) {
      onClose();
      return;
    }
    setExiting(true);
    setRevealed(false);
  }, [exiting, onClose, reduceMotion]);

  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      requestClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, requestClose]);

  const handleBackdropClick = () => {
    requestClose();
  };

  const handleOpenProject = async () => {
    if (picking) return;
    setPicking(true);
    setError(null);
    try {
      const path = await folderPicker.pickFolder();
      if (path === null) return;
      projectOpenFolder(path);
      onWorkspaceOpened?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`[ERROR: ${message}]`);
    } finally {
      setPicking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="presentation"
      onClick={onClose ? handleBackdropClick : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-popup-title"
        className={cn(
          "relative w-full max-w-[420px] rounded-[6px] border border-border bg-background px-8 py-10",
          "origin-center transition-[transform,opacity] duration-[var(--duration-ui-popover)] ease-[var(--ease-out)]",
          revealed ? "scale-100 opacity-100" : "scale-[0.95] opacity-0",
          "motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none",
        )}
        onClick={(event) => event.stopPropagation()}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            exiting &&
            (event.propertyName === "opacity" || event.propertyName === "transform")
          ) {
            onClose?.();
          }
        }}
      >
        {onClose ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="absolute right-3 top-3"
            aria-label="Close workspace popup"
            onClick={requestClose}
          >
            <XIcon className="stroke-[1.5]" />
          </Button>
        ) : null}
        <div className="flex flex-col items-center gap-6 text-center">
          <img
            src={
              mode === "dark"
                ? "/brand/opencore-logo-dark.png"
                : "/brand/opencore-logo-light.png"
            }
            alt="OpenCore"
            className="h-10 w-auto"
          />

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Welcome back to</p>
            <h1
              id="workspace-popup-title"
              className="font-mono text-3xl uppercase tracking-[0.06em]"
            >
              OPENCORE
            </h1>
            <p className="text-sm text-muted-foreground">
              Pick up where you left off or start something new
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Get started
            </p>
            <ul className="flex flex-col gap-1">
              {GET_STARTED_ACTIONS.map((action) => (
                <li key={action.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-mono text-[11px] uppercase tracking-[0.08em] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                    aria-disabled={action.enabled ? undefined : "true"}
                    disabled={action.id === "open-project" && picking}
                    onClick={
                      action.enabled ? handleOpenProject : undefined
                    }
                  >
                    {action.label}
                  </Button>
                </li>
              ))}
            </ul>
            {error ? (
              <p
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2 border-t border-border pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Recent projects
            </p>
            <p className="text-sm text-muted-foreground">No recent projects</p>
          </div>
        </div>
      </div>
    </div>
  );
}
