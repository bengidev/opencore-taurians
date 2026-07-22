import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createTauriExplorerApi } from "../../explorer/api/explorerApi";
import type { ExplorerEntry } from "../../explorer/domain/explorerTypes";
import { isUntitledId } from "../state/editorTabId";
import { useEditorStore } from "../state/editorStore";

function joinPath(dir: string, name: string): string {
  const base = dir.endsWith("/") ? dir.slice(0, -1) : dir;
  return `${base}/${name}`;
}

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? path : path.slice(0, index);
}

function basename(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? path : path.slice(index + 1);
}

function relativize(root: string, dir: string): string {
  if (dir === root) {
    return ".";
  }
  const prefix = `${root}/`;
  if (dir.startsWith(prefix)) {
    return dir.slice(prefix.length);
  }
  return dir;
}

async function defaultListDir(
  projectRoot: string,
  dir: string,
): Promise<ExplorerEntry[]> {
  return createTauriExplorerApi().listDir(projectRoot, dir);
}

async function defaultListSubdirs(
  projectRoot: string,
  dir: string,
): Promise<string[]> {
  const entries = await defaultListDir(projectRoot, dir);
  return entries.filter((entry) => entry.isDir).map((entry) => entry.name).sort();
}

async function targetExists(
  projectRoot: string,
  directory: string,
  filename: string,
  targetPath: string,
  listDir: (projectRoot: string, dir: string) => Promise<ExplorerEntry[]>,
): Promise<boolean> {
  const api = useEditorStore.getState().api;
  if (api && "files" in api && api.files instanceof Map && api.files.has(targetPath)) {
    return true;
  }

  if (api) {
    try {
      await api.readFile(projectRoot, targetPath);
      return true;
    } catch {
      // not found via read
    }
  }

  const entries = await listDir(projectRoot, directory);
  return entries.some((entry) => entry.name === filename && !entry.isDir);
}

export function EditorSaveAsDialog({
  sourceId,
  onOpenChange,
  onSuccess,
  onFailure,
  listSubdirs = defaultListSubdirs,
  listDir = defaultListDir,
}: {
  sourceId: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (savedPath: string) => void;
  onFailure?: () => void;
  listSubdirs?: (projectRoot: string, dir: string) => Promise<string[]>;
  listDir?: (projectRoot: string, dir: string) => Promise<ExplorerEntry[]>;
}): JSX.Element | null {
  const projectRoot = useEditorStore((s) => s.projectRoot);
  const saveError = useEditorStore((s) =>
    sourceId ? (s.buffers[sourceId]?.saveError ?? null) : null,
  );

  const [directory, setDirectory] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [subdirs, setSubdirs] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "overwrite">("form");
  const [pendingTargetPath, setPendingTargetPath] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceId || !projectRoot) {
      setDirectory(null);
      setFilename("");
      setValidationError(null);
      setStep("form");
      setPendingTargetPath(null);
      return;
    }

    const initialDirectory = isUntitledId(sourceId)
      ? projectRoot
      : parentDir(sourceId);
    const initialFilename = isUntitledId(sourceId) ? "" : basename(sourceId);

    setDirectory(initialDirectory);
    setFilename(initialFilename);
    setValidationError(null);
    setStep("form");
    setPendingTargetPath(null);
    useEditorStore.getState().clearSaveError(sourceId);
  }, [sourceId, projectRoot]);

  useEffect(() => {
    if (!sourceId || !projectRoot || !directory) {
      setSubdirs([]);
      return;
    }

    let cancelled = false;
    void listSubdirs(projectRoot, directory).then((names) => {
      if (!cancelled) {
        setSubdirs(names);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sourceId, projectRoot, directory, listSubdirs]);

  if (!sourceId || !projectRoot || !directory) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onOpenChange(false);
    }
  };

  const performSave = async (targetPath: string) => {
    const ok = await useEditorStore.getState().saveAs(sourceId, targetPath);
    if (ok) {
      onSuccess?.(targetPath);
      onOpenChange(false);
      return;
    }
    onFailure?.();
    setStep("form");
    setPendingTargetPath(null);
  };

  const handleSave = async () => {
    const trimmed = filename.trim();
    if (!trimmed) {
      setValidationError("Enter a file name.");
      return;
    }
    setValidationError(null);

    const targetPath = joinPath(directory, trimmed);
    const exists = await targetExists(
      projectRoot,
      directory,
      trimmed,
      targetPath,
      listDir,
    );
    if (exists) {
      setPendingTargetPath(targetPath);
      setStep("overwrite");
      return;
    }
    await performSave(targetPath);
  };

  const handleReplace = async () => {
    if (!pendingTargetPath) {
      return;
    }
    await performSave(pendingTargetPath);
  };

  const handleCancelOverwrite = () => {
    setStep("form");
    setPendingTargetPath(null);
  };

  const handleUp = () => {
    if (directory === projectRoot) {
      return;
    }
    const parent = parentDir(directory);
    setDirectory(parent.length < projectRoot.length ? projectRoot : parent);
  };

  const handleEnterSubdir = (name: string) => {
    setDirectory(joinPath(directory, name));
  };

  const relativeDirectory = relativize(projectRoot, directory);

  return (
    <DialogPrimitive.Root open={sourceId !== null} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-border bg-popover p-4 text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          {step === "overwrite" ? (
            <div className="flex flex-col gap-3">
              <DialogPrimitive.Title className="font-heading text-base font-medium text-foreground">
                Replace existing file?
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {pendingTargetPath ? basename(pendingTargetPath) : "This file"} already
                exists. Replace it with the current contents?
              </DialogPrimitive.Description>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelOverwrite}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => void handleReplace()}>
                  Replace
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <DialogPrimitive.Title className="font-heading text-base font-medium text-foreground">
                Save As
              </DialogPrimitive.Title>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Folder: <span className="font-mono text-foreground">{relativeDirectory}</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={directory === projectRoot}
                    onClick={handleUp}
                  >
                    Up
                  </Button>
                </div>
                <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                  {subdirs.map((name) => (
                    <Button
                      key={name}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => handleEnterSubdir(name)}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">File name</span>
                  <input
                    aria-label="File name"
                    className={cn(
                      "rounded-[4px] border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:border-foreground/30 focus-visible:ring-1 focus-visible:ring-ring/40",
                    )}
                    value={filename}
                    onChange={(event) => {
                      setFilename(event.target.value);
                      if (validationError) {
                        setValidationError(null);
                      }
                    }}
                  />
                </label>
                {validationError ? (
                  <p className="text-xs text-destructive">{validationError}</p>
                ) : null}
                {saveError ? (
                  <p className="font-mono text-xs text-destructive">{saveError}</p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
