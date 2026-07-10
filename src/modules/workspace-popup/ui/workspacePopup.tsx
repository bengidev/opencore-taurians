import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "../../onboarding";
import {
  createTauriFolderPicker,
  type FolderPicker,
} from "../infrastructure/workspaceFolderPicker";
import { useWorkspaceStore } from "../state/workspaceStore";

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
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = () => {
    onClose?.();
  };

  const handleOpenProject = async () => {
    if (picking) return;
    setPicking(true);
    setError(null);
    try {
      const path = await folderPicker.pickFolder();
      if (path === null) return;
      setWorkspace(path);
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
          "origin-center transition-[transform,opacity] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          mounted ? "scale-100 opacity-100" : "scale-[0.95] opacity-0",
          "motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {onClose ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="absolute right-3 top-3"
            aria-label="Close workspace popup"
            onClick={onClose}
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
