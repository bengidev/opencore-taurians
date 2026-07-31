import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSourceControlStore } from "../state/sourceControlStore";
import type { SourceControlFileStatus, ResolvedSourceControlCheckout } from "../api/sourceControlContracts";

function ToggleCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-fit items-center gap-2 text-xs"
    >
      <span
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-transparent"
        }`}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      {label}
    </button>
  );
}

export interface SourceControlCommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trunkId: string;
  checkout: ResolvedSourceControlCheckout;
  stagedFiles: SourceControlFileStatus[];
}

export function SourceControlCommitDialog({
  open,
  onOpenChange,
  trunkId,
  checkout,
  stagedFiles,
}: SourceControlCommitDialogProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signoff, setSignoff] = useState(false);
  const [amend, setAmend] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = subject.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await useSourceControlStore.getState().runCommit(trunkId, checkout, {
        checkoutPath: checkout.checkoutPath,
        subject: subject.trim(),
        body,
        amend,
        signoff,
        newBranch: newBranch.trim() || null,
        selectedPaths: null,
      });
      setSubject("");
      setBody("");
      setSignoff(false);
      setAmend(false);
      setNewBranch("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[320px] flex-col gap-3 p-4">
        <SheetHeader>
          <SheetTitle>Commit changes</SheetTitle>
          <SheetDescription>
            Create a commit from {stagedFiles.length} staged file
            {stagedFiles.length === 1 ? "" : "s"}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Subject
            </span>
            <input
              className="rounded border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-foreground"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="feat: summary"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Body
            </span>
            <textarea
              className="min-h-[80px] resize-y rounded border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-foreground"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optional description"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              New branch (optional)
            </span>
            <input
              className="rounded border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-foreground"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="feature/x"
            />
          </label>

          <div className="flex flex-col gap-2">
            <ToggleCheckbox
              checked={signoff}
              onChange={setSignoff}
              label="Sign off"
            />
            <ToggleCheckbox
              checked={amend}
              onChange={setAmend}
              label="Amend previous commit"
            />
          </div>

          {stagedFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Staged files
              </span>
              <ul className="max-h-[120px] overflow-y-auto rounded border border-border bg-secondary/10 p-1 text-[11px] font-mono">
                {stagedFiles.map((file) => (
                  <li key={file.path} className="truncate text-muted-foreground">
                    {file.path}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose
            render={<Button variant="ghost" size="sm">Cancel</Button>}
          />
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            Commit
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
