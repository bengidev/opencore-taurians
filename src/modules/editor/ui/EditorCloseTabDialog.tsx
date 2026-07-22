import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditorStore } from "../state/editorStore";

function tabBasename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export function EditorCloseTabDialog({
  path,
  onOpenChange,
}: {
  path: string | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  const saveError = useEditorStore((s) =>
    path ? (s.buffers[path]?.saveError ?? null) : null,
  );

  if (!path) {
    return null;
  }

  const basename = tabBasename(path);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onOpenChange(false);
    }
  };

  const handleSave = async () => {
    const ok = await useEditorStore.getState().saveTab(path);
    if (ok) {
      useEditorStore.getState().closeTab(path);
      onOpenChange(false);
    }
  };

  const handleDontSave = () => {
    useEditorStore.getState().closeTab(path);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={path !== null} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-border bg-popover p-4 text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <div className="flex flex-col gap-3">
            <DialogPrimitive.Title className="font-heading text-base font-medium text-foreground">
              Save changes?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Do you want to save changes to {basename}?
            </DialogPrimitive.Description>
            {saveError ? (
              <p className="font-mono text-xs text-destructive">{saveError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleDontSave}>
                Don&apos;t save
              </Button>
              <Button type="button" size="sm" onClick={() => void handleSave()}>
                Save
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
