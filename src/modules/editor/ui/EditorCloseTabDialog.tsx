import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isUntitledId, tabLabel } from "../state/editorTabId";
import { useEditorStore } from "../state/editorStore";

export function EditorCloseTabDialog({
  id,
  onOpenChange,
  onRequestSaveAsForClose,
  onDontSave,
  onCancel,
}: {
  id: string | null;
  onOpenChange: (open: boolean) => void;
  onRequestSaveAsForClose?: (id: string) => void;
  onDontSave?: (id: string) => void;
  onCancel?: () => void;
}): ReactElement | null {
  const saveError = useEditorStore((s) =>
    id ? (s.buffers[id]?.saveError ?? null) : null,
  );

  if (!id) {
    return null;
  }

  const label = tabLabel(id);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onOpenChange(false);
    }
  };

  const handleSave = async () => {
    if (isUntitledId(id)) {
      onRequestSaveAsForClose?.(id);
      onOpenChange(false);
      return;
    }

    const ok = await useEditorStore.getState().saveTab(id);
    if (ok) {
      useEditorStore.getState().closeTab(id);
      onOpenChange(false);
    }
  };

  const handleDontSave = () => {
    if (onDontSave) {
      onDontSave(id);
      return;
    }
    useEditorStore.getState().closeTab(id);
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={id !== null} onOpenChange={handleOpenChange}>
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
              Do you want to save changes to {label}?
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
