import { Lock } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { isUntitledId, tabLabel } from "../state/editorTabId";
import { useEditorStore } from "../state/editorStore";

const editorTabContextMenuClassName =
  "min-w-36 font-mono text-xs tracking-[0.08em]";

export interface EditorTabStripProps {
  onRequestCloseTab: (id: string) => void;
  onRequestSaveAs: (id: string) => void;
  onRequestCloseOthers: (keepId: string) => void;
  onRequestCloseAll: () => void;
}

export function EditorTabStrip({
  onRequestCloseTab,
  onRequestSaveAs,
  onRequestCloseOthers,
  onRequestCloseAll,
}: EditorTabStripProps) {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const buffers = useEditorStore((s) => s.buffers);
  const projectRoot = useEditorStore((s) => s.projectRoot);
  const setActiveTabId = useEditorStore((s) => s.setActiveTabId);
  const openUntitled = useEditorStore((s) => s.openUntitled);

  return (
    <div
      role="tablist"
      aria-label="Editor tabs"
      className="flex min-w-0 items-center gap-1"
    >
      {tabs.map((tab) => {
        const label = tabLabel(tab.id);
        const dirty = buffers[tab.id]?.dirty ?? false;
        const readOnly = buffers[tab.id]?.readOnly ?? false;
        const selected = tab.id === activeTabId;
        const displayLabel = dirty ? `${label} •` : label;

        return (
          <ContextMenu
            key={tab.id}
            onOpenChange={(open) => {
              if (open) setActiveTabId(tab.id);
            }}
          >
            <div className="flex min-w-0 items-center">
              <ContextMenuTrigger
                render={
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={displayLabel}
                    className="rounded-[6px] border border-transparent px-2 py-0.5 font-mono text-[11px] tracking-[0.02em] text-muted-foreground aria-selected:border-border aria-selected:bg-muted aria-selected:text-foreground"
                  />
                }
                onClick={() => setActiveTabId(tab.id)}
              >
                <span className="flex items-center gap-1">
                  {displayLabel}
                  {readOnly ? (
                    <Lock
                      aria-label="Read-only"
                      className="size-3 shrink-0 opacity-70"
                    />
                  ) : null}
                </span>
              </ContextMenuTrigger>
              <button
                type="button"
                aria-label={`Close ${label}`}
                className="rounded-[6px] px-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => onRequestCloseTab(tab.id)}
              >
                ×
              </button>
            </div>
            <ContextMenuContent className={editorTabContextMenuClassName}>
              <ContextMenuItem
                disabled={readOnly}
                onClick={() => {
                  if (isUntitledId(tab.id)) onRequestSaveAs(tab.id);
                  else void useEditorStore.getState().saveTab(tab.id);
                }}
              >
                Save
              </ContextMenuItem>
              <ContextMenuItem
                disabled={readOnly}
                onClick={() => onRequestSaveAs(tab.id)}
              >
                Save As…
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onRequestCloseTab(tab.id)}>
                Close
              </ContextMenuItem>
              <ContextMenuItem
                disabled={tabs.length < 2}
                onClick={() => onRequestCloseOthers(tab.id)}
              >
                Close Others
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onRequestCloseAll()}>
                Close All
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <button
        type="button"
        disabled={!projectRoot}
        aria-label="New untitled file"
        className="rounded-[6px] border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground disabled:opacity-50"
        onClick={() => {
          if (!projectRoot) {
            return;
          }
          openUntitled();
        }}
      >
        +
      </button>
    </div>
  );
}
