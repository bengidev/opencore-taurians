import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Check,
  ChevronDown,
  GitPullRequestArrow,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useProjectStore } from "../../project/state/projectStore";
import { createTauriSourceControlApi, type SourceControlApi } from "../api/sourceControlApi";
import type {
  SourceControlFileStatus,
  SourceControlRepositorySnapshot,
  ResolvedSourceControlCheckout,
  SourceControlLogEntry,
} from "../api/sourceControlContracts";
import { resolveSourceControlBadge } from "../domain/sourceControlIconBadge";
import { useSourceControlStore } from "../state/sourceControlStore";
import { useSourceControlWatchLifecycle } from "../state/useSourceControlWatchLifecycle";
import { SourceControlDiffPreview } from "./SourceControlDiffPreview";
import { SourceControlIconBadge } from "./SourceControlIconBadge";

const defaultApi = createTauriSourceControlApi();

type PanelAction =
  | "fetch"
  | "pull"
  | "push"
  | "refresh-log"
  | "stage-all"
  | "commit";

const ACTION_SUCCESS_MS = 1100;

export interface SourceControlPanelProps {
  sourceControlApi?: SourceControlApi;
}

export function SourceControlPanel({ sourceControlApi = defaultApi }: SourceControlPanelProps) {
  const activeTrunkId = useProjectStore((s) => s.activeTrunkId);
  const activeTrunk = useProjectStore((s) =>
    activeTrunkId ? s.trunks.find((t) => t.id === activeTrunkId) : null,
  );
  const checkoutRuntime = activeTrunkId
    ? useProjectStore((s) => s.checkoutRuntimeByTrunkId[activeTrunkId])
    : undefined;

  const snapshot = useSourceControlStore((s) =>
    activeTrunkId ? s.snapshotsByTrunkId[activeTrunkId] : undefined,
  );
  const log = useSourceControlStore((s) =>
    activeTrunkId ? s.logByTrunkId[activeTrunkId] : undefined,
  );
  const loading = useSourceControlStore((s) =>
    activeTrunkId ? Boolean(s.loadingByTrunkId[activeTrunkId]) : false,
  );
  const error = useSourceControlStore((s) =>
    activeTrunkId ? s.errorByTrunkId[activeTrunkId] : undefined,
  );

  const [discardTarget, setDiscardTarget] = useState<SourceControlFileStatus | null>(null);

  // Inline commit state
  const [message, setMessage] = useState("");
  const [commitDetailsOpen, setCommitDetailsOpen] = useState(false);
  const [signoff, setSignoff] = useState(false);
  const [amend, setAmend] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const [busyAction, setBusyAction] = useState<PanelAction | null>(null);
  const [successAction, setSuccessAction] = useState<PanelAction | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busyFileAction, setBusyFileAction] = useState<{
    path: string;
    kind: "stage" | "unstage" | "discard";
  } | null>(null);

  // Section expansion state
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(true);

  // Inline diff state
  const [expandedDiffPath, setExpandedDiffPath] = useState<string | null>(null);
  const [diffByPath, setDiffByPath] = useState<
    Record<string, { patch: string; truncated: boolean; error: string | null; loading: boolean }>
  >({});

  // Selected graph commit (shows details inline)
  const [selectedCommitOid, setSelectedCommitOid] = useState<string | null>(null);

  const checkout: ResolvedSourceControlCheckout | null =
    checkoutRuntime?.status === "ready" ? checkoutRuntime.checkout : null;

  // Bind the API once.
  useEffect(() => {
    useSourceControlStore.getState().bindApi(sourceControlApi);
  }, [sourceControlApi]);

  // Load snapshot when the checkout becomes ready.
  useEffect(() => {
    if (!activeTrunkId || !checkout) return;
    void useSourceControlStore.getState().loadSnapshot(activeTrunkId, checkout);
  }, [activeTrunkId, checkout?.checkoutIdentity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load log when the checkout becomes ready.
  useEffect(() => {
    if (!activeTrunkId || !checkout) return;
    if (log && log.length > 0) return;
    void useSourceControlStore
      .getState()
      .loadLog(activeTrunkId, checkout)
      .catch(() => {
        // Error is stored on the source-control store for the panel alert.
      });
  }, [activeTrunkId, checkout?.checkoutIdentity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live watch refresh.
  useSourceControlWatchLifecycle(activeTrunkId, checkout);

  const badge = useMemo(() => resolveSourceControlBadge(snapshot ?? null), [snapshot]);

  const stagedFiles = useMemo(() => filesWithIndexStatus(snapshot), [snapshot]);
  const changedFiles = useMemo(() => filesWithWorktreeChanges(snapshot), [snapshot]);

  const canCommit = message.trim().length > 0 && busyAction === null;

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const flashSuccess = (action: PanelAction) => {
    setSuccessAction(action);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => {
      setSuccessAction((current) => (current === action ? null : current));
      successTimerRef.current = null;
    }, ACTION_SUCCESS_MS);
  };

  const runPanelAction = async (action: PanelAction, task: () => Promise<void>) => {
    if (busyAction) return;
    setBusyAction(action);
    setSuccessAction((current) => (current === action ? null : current));
    try {
      await task();
      flashSuccess(action);
    } catch {
      // Error is stored on the source-control store for the panel alert.
    } finally {
      setBusyAction(null);
    }
  };

  const handleCommit = async () => {
    if (!canCommit || !activeTrunkId || !checkout) return;
    const trimmed = message.trim();
    const newlineIndex = trimmed.indexOf("\n");
    const subject = newlineIndex === -1 ? trimmed : trimmed.slice(0, newlineIndex).trim();
    const body = newlineIndex === -1 ? "" : trimmed.slice(newlineIndex + 1).trim();

    await runPanelAction("commit", async () => {
      await useSourceControlStore.getState().runCommit(activeTrunkId, checkout, {
        checkoutPath: checkout.checkoutPath,
        subject,
        body,
        amend,
        signoff,
        newBranch: newBranch.trim() || null,
        selectedPaths: null,
      });
      setMessage("");
      setSignoff(false);
      setAmend(false);
      setNewBranch("");
      setCommitDetailsOpen(false);
    });
  };

  const handleFetch = () => {
    if (!activeTrunkId || !checkout) return;
    void runPanelAction("fetch", () =>
      useSourceControlStore.getState().runFetch(activeTrunkId, checkout, {
        checkoutPath: checkout.checkoutPath,
        prune: false,
        remote: null,
      }),
    );
  };

  const handlePull = () => {
    if (!activeTrunkId || !checkout) return;
    void runPanelAction("pull", () =>
      useSourceControlStore.getState().runPull(activeTrunkId, checkout, {
        checkoutPath: checkout.checkoutPath,
        strategy: "ff-only",
        rebase: false,
      }),
    );
  };

  const handlePush = () => {
    if (!activeTrunkId || !checkout) return;
    void runPanelAction("push", () =>
      useSourceControlStore.getState().runPush(activeTrunkId, checkout, {
        checkoutPath: checkout.checkoutPath,
        remote: null,
        refspec: null,
        setUpstream: false,
        forceWithLease: null,
      }),
    );
  };

  const toggleDiff = async (file: SourceControlFileStatus, staged: boolean) => {
    if (!checkout || !activeTrunk) return;

    if (expandedDiffPath === file.path) {
      setExpandedDiffPath(null);
      return;
    }

    setExpandedDiffPath(file.path);

    if (diffByPath[file.path]) {
      return;
    }

    setDiffByPath((prev) => ({
      ...prev,
      [file.path]: { patch: "", truncated: false, error: null, loading: true },
    }));

    try {
      const result = await sourceControlApi.getDiff({
        projectId: activeTrunk.projectId,
        trunkId: activeTrunk.id,
        checkoutPath: checkout.checkoutPath,
        source: staged ? { kind: "staged" } : { kind: "working-tree" },
        ignoreWhitespace: false,
        maxBytes: 524288,
        pathspec: file.path,
      });
      setDiffByPath((prev) => ({
        ...prev,
        [file.path]: { patch: result.patch, truncated: result.truncated, error: null, loading: false },
      }));
    } catch (err) {
      setDiffByPath((prev) => ({
        ...prev,
        [file.path]: {
          patch: "",
          truncated: false,
          error: err instanceof Error ? err.message : "Failed to load diff.",
          loading: false,
        },
      }));
    }
  };

  const refreshLog = () => {
    if (!activeTrunkId || !checkout) return;
    void runPanelAction("refresh-log", () =>
      useSourceControlStore.getState().loadLog(activeTrunkId, checkout),
    );
  };

  const runFileAction = async (
    path: string,
    kind: "stage" | "unstage" | "discard",
    task: () => Promise<void>,
  ) => {
    if (busyFileAction) return;
    setBusyFileAction({ path, kind });
    try {
      await task();
    } catch {
      // Error is stored on the source-control store for the panel alert.
    } finally {
      setBusyFileAction(null);
    }
  };

  if (!activeTrunk) {
    return (
      <PanelShell>
        <p className="text-sm text-muted-foreground">
          Select a trunk to view source control.
        </p>
      </PanelShell>
    );
  }


  if (checkoutRuntime?.status === "invalid") {
    return (
      <PanelShell badge={badge}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            The saved checkout is no longer valid.
          </p>
          <p className="text-xs text-muted-foreground">
            {checkoutRuntime.message}
          </p>
        </div>
      </PanelShell>
    );
  }

  if (checkoutRuntime?.status === "resolving" || (loading && !snapshot)) {
    return (
      <PanelShell badge={badge}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PanelShell>
    );
  }

  if (snapshot && snapshot.repositoryState === "git-unavailable") {
    return (
      <PanelShell badge={badge}>
        <p className="text-sm text-muted-foreground">
          Git is not installed on this system.
        </p>
      </PanelShell>
    );
  }

  if (snapshot && snapshot.repositoryState === "not-repository") {
    return (
      <PanelShell badge={badge}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Not a SourceControl repository.
          </p>
          {checkout && (
            <Button
              size="sm"
              onClick={async () => {
                await sourceControlApi.initialize({
                  projectId: activeTrunk.projectId,
                  trunkId: activeTrunk.id,
                  checkoutPath: checkout.checkoutPath,
                });
                await useSourceControlStore
                  .getState()
                  .loadSnapshot(activeTrunk.id, checkout);
              }}
            >
              Initialize repository
            </Button>
          )}
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      badge={badge}
      onFetch={checkout ? handleFetch : undefined}
      onPull={checkout ? handlePull : undefined}
      onPush={checkout ? handlePush : undefined}
      busyAction={busyAction}
      successAction={successAction}
    >
      {error && (
        <div
          role="alert"
          className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
        >
          {error.message}
        </div>
      )}

      {snapshot && snapshot.conflictCount > 0 && (
        <div className="rounded border border-[var(--git-conflict)]/40 bg-[var(--git-conflict-bg)] px-2 py-1.5 text-xs text-[var(--git-conflict)]">
          Unresolved conflicts ({snapshot.conflictCount}). Resolve them before
          continuing.
        </div>
      )}

      {/* Inline commit message area */}
      <div className="space-y-1.5">
        <textarea
          className="min-h-[60px] w-full resize-y rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px] tracking-[0.04em] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] focus-visible:border-foreground/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (⌘Enter to commit)"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              e.preventDefault();
              void handleCommit();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              disabled={!canCommit}
              aria-busy={busyAction === "commit"}
              onClick={() => void handleCommit()}
            >
              {busyAction === "commit" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : successAction === "commit" ? (
                <Check className="size-3 text-[var(--git-added)]" />
              ) : (
                <Check className="size-3" />
              )}
              {busyAction === "commit"
                ? "Committing…"
                : successAction === "commit"
                  ? "Committed"
                  : "Commit"}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={commitDetailsOpen ? "Hide commit details" : "Show commit details"}
              title={commitDetailsOpen ? "Hide commit details" : "Show commit details"}
              onClick={() => setCommitDetailsOpen((prev) => !prev)}
            >
              <ChevronDown
                className={cn(
                  "size-3 transition-transform duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] motion-reduce:transition-none",
                  commitDetailsOpen ? "rotate-0" : "-rotate-90",
                )}
              />
            </Button>
          </div>
          {snapshot?.upstream && (
            <span className="font-mono text-[10px] text-muted-foreground">
              ↑{snapshot.ahead} ↓{snapshot.behind}
            </span>
          )}
        </div>
        <div
          className={cn(
            "grid overflow-hidden transition-[grid-template-rows,opacity] duration-[var(--duration-ui-panel-show)] ease-[var(--ease-out)] motion-reduce:transition-none",
            commitDetailsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0">
            <div className="space-y-2 rounded border border-border bg-secondary/10 p-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                New branch
              </span>
              <input
                className="rounded border border-border bg-background px-2 py-1 text-xs focus-visible:border-foreground focus-visible:outline-none"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder="feature/x"
              />
            </label>
            <div className="flex flex-col gap-2">
              <ToggleCheckbox checked={signoff} onChange={setSignoff} label="Sign off" />
              <ToggleCheckbox
                checked={amend}
                onChange={setAmend}
                label="Amend previous commit"
              />
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Changes */}
      <CollapsibleSection
        label="Changes"
        count={changedFiles.length}
        expanded={changesExpanded}
        onToggle={() => setChangesExpanded((prev) => !prev)}
        action={
          checkout && changedFiles.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              disabled={busyAction !== null}
              aria-busy={busyAction === "stage-all"}
              onClick={() =>
                void runPanelAction("stage-all", () =>
                  useSourceControlStore.getState().runStage(activeTrunk.id, checkout, {
                    checkoutPath: checkout.checkoutPath,
                    paths: changedFiles.map((f) => f.path),
                    mode: "stage",
                  }),
                )
              }
            >
              {busyAction === "stage-all" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : successAction === "stage-all" ? (
                <Check className="size-3 text-[var(--git-added)]" />
              ) : null}
              {busyAction === "stage-all"
                ? "Staging…"
                : successAction === "stage-all"
                  ? "Staged"
                  : "Stage all"}
            </Button>
          ) : null
        }
      >
        {changedFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground">No working changes.</p>
        ) : (
          <ul className="space-y-0.5">
            {changedFiles.map((file) => {
              const expanded = expandedDiffPath === file.path;
              return (
              <li
                key={file.path}
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden rounded-[4px] transition-[background-color,box-shadow] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)]",
                  expanded
                    ? "bg-muted shadow-[inset_0_0_0_1px_var(--border)]"
                    : "hover:bg-secondary/30",
                )}
              >
                <FileRow
                  file={file}
                  expanded={expanded}
                  busyKind={
                    busyFileAction?.path === file.path ? busyFileAction.kind : null
                  }
                  onStage={() => {
                    if (!checkout) return;
                    void runFileAction(file.path, "stage", () =>
                      useSourceControlStore.getState().runStage(
                        activeTrunk.id,
                        checkout,
                        {
                          checkoutPath: checkout.checkoutPath,
                          paths: [file.path],
                          mode: "stage",
                        },
                      ),
                    );
                  }}
                  onDiscard={() => setDiscardTarget(file)}
                  onToggleDiff={() => void toggleDiff(file, false)}
                />
                <DiffInline
                  expanded={expanded}
                  diff={diffByPath[file.path]}
                />
              </li>
              );
            })}
          </ul>
        )}
      </CollapsibleSection>

      {/* Staged */}
      <CollapsibleSection
        label="Staged"
        count={stagedFiles.length}
        expanded={stagedExpanded}
        onToggle={() => setStagedExpanded((prev) => !prev)}
      >
        {stagedFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing staged.</p>
        ) : (
          <ul className="space-y-0.5">
            {stagedFiles.map((file) => {
              const expanded = expandedDiffPath === file.path;
              return (
              <li
                key={file.path}
                className={cn(
                  "flex min-w-0 flex-col overflow-hidden rounded-[4px] transition-[background-color,box-shadow] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)]",
                  expanded
                    ? "bg-muted shadow-[inset_0_0_0_1px_var(--border)]"
                    : "hover:bg-secondary/30",
                )}
              >
                <FileRow
                  file={file}
                  staged
                  expanded={expanded}
                  busyKind={
                    busyFileAction?.path === file.path ? busyFileAction.kind : null
                  }
                  onUnstage={() => {
                    if (!checkout) return;
                    void runFileAction(file.path, "unstage", () =>
                      useSourceControlStore.getState().runStage(
                        activeTrunk.id,
                        checkout,
                        {
                          checkoutPath: checkout.checkoutPath,
                          paths: [file.path],
                          mode: "unstage",
                        },
                      ),
                    );
                  }}
                  onToggleDiff={() => void toggleDiff(file, true)}
                />
                <DiffInline
                  expanded={expanded}
                  diff={diffByPath[file.path]}
                />
              </li>
              );
            })}
          </ul>
        )}
      </CollapsibleSection>

      {/* Graph */}
      <CollapsibleSection
        label="Graph"
        expanded={graphExpanded}
        onToggle={() => setGraphExpanded((prev) => !prev)}
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Refresh graph"
            title="Refresh graph"
            aria-busy={busyAction === "refresh-log"}
            disabled={busyAction !== null}
            onClick={refreshLog}
            className="text-muted-foreground"
          >
            <RefreshCw
              className={cn(
                "size-3 transition-transform duration-[var(--duration-ui-fast)] ease-[var(--ease-out)]",
                busyAction === "refresh-log" && "animate-spin",
                successAction === "refresh-log" && "text-[var(--git-added)]",
              )}
            />
          </Button>
        }
      >
        {log && log.length > 0 ? (
          <ul className="relative space-y-3 pl-4">
            <li className="absolute inset-y-1 left-[7px] w-px border-l border-border" aria-hidden="true" />
            {log.map((entry) => (
              <GraphRow
                key={entry.oid}
                entry={entry}
                selected={selectedCommitOid === entry.oid}
                onSelect={() =>
                  setSelectedCommitOid((prev) =>
                    prev === entry.oid ? null : entry.oid,
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No commits.</p>
        )}
      </CollapsibleSection>

      <DiscardConfirm
        file={discardTarget}
        open={discardTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDiscardTarget(null);
        }}
        onConfirm={() => {
          if (!checkout || !discardTarget) return;
          const target = discardTarget;
          setDiscardTarget(null);
          void runFileAction(target.path, "discard", () =>
            useSourceControlStore.getState().runDiscard(activeTrunk.id, checkout, {
              checkoutPath: checkout.checkoutPath,
              paths: [target.path],
              mode:
                target.worktreeStatus === "untracked"
                  ? "untracked"
                  : "tracked",
            }),
          );
        }}
      />
    </PanelShell>
  );
}

function GraphRow({
  entry,
  selected,
  onSelect,
}: {
  entry: SourceControlLogEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const dateText = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
        new Date(entry.dateIso),
      );
    } catch {
      return entry.dateIso.slice(0, 10);
    }
  }, [entry.dateIso]);

  return (
    <li className="relative flex min-w-0 flex-col pl-4">
      {/* Dot — absolutely positioned so its center sits exactly on the line */}
      <span
        className={cn(
          "absolute left-[-13.5px] top-[7px] z-10 size-2.5 rounded-full border-2 ring-[3px] ring-background transition-colors duration-[var(--duration-ui-fast)] ease-[var(--ease-out)]",
          selected
            ? "border-accent-foreground bg-accent-foreground"
            : "border-primary bg-primary",
        )}
      />
      <div
        className={cn(
          "relative min-w-0 overflow-hidden rounded-[4px] transition-[background-color,box-shadow] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)]",
          selected
            ? "bg-muted shadow-[inset_0_0_0_1px_var(--border)]"
            : "hover:bg-secondary/40",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-expanded={selected}
          className="min-w-0 w-full px-1.5 py-1 text-left"
        >
          <p className="truncate text-xs text-foreground" title={entry.subject}>
            {entry.subject}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {entry.shortOid}
            </span>
            {entry.refs.map((ref, index) => (
              <span
                key={index}
                className={cn(
                  "rounded px-1 text-[10px]",
                  ref.includes("HEAD")
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {ref}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {entry.author} • {dateText}
          </p>
        </button>
        {/* Animated commit details — inline under the title */}
        <div
          className={cn(
            "grid overflow-hidden transition-[grid-template-rows,opacity] duration-[var(--duration-ui-panel-show)] ease-[var(--ease-out)] motion-reduce:transition-none",
            selected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 min-w-0">
            <div className="min-w-0 space-y-1 border-t border-border/60 px-1.5 py-1.5">
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">Commit</span>
                <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-0.5 pr-1 font-mono text-[10px] text-foreground">{entry.oid}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">Author</span>
                <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-0.5 pr-1 text-[10px] text-foreground">{entry.author}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">Date</span>
                <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-0.5 pr-1 text-[10px] text-foreground">{entry.dateIso}</span>
              </div>
              {entry.refs.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">Refs</span>
                  <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-0.5 pr-1 font-mono text-[10px] text-foreground">
                    {entry.refs.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function DiffInline({
  expanded,
  diff,
}: {
  expanded: boolean;
  diff: { patch: string; truncated: boolean; error: string | null; loading: boolean } | undefined;
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows,opacity] duration-[var(--duration-ui-panel-show)] ease-[var(--ease-out)] motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 min-w-0">
        <div className="w-full min-w-0 border-t border-border/60">
          {diff?.loading ? (
            <p className="px-1.5 py-1 text-[10px] text-muted-foreground">Loading…</p>
          ) : diff ? (
            <SourceControlDiffPreview
              patch={diff.patch}
              truncated={diff.truncated}
              error={diff.error}
              hideFileHeaders
              className="max-h-[300px] w-full min-w-0 overflow-hidden"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PanelShell({
  children,
  badge,
  onFetch,
  onPull,
  onPush,
  busyAction,
  successAction,
}: {
  children: React.ReactNode;
  badge?: { kind: string; count: number };
  onFetch?: () => void;
  onPull?: () => void;
  onPush?: () => void;
  busyAction?: PanelAction | null;
  successAction?: PanelAction | null;
}) {
  return (
    <aside
      aria-label="source control panel"
      className="flex h-full min-h-0 min-w-0 flex-col bg-background"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Source control
        </p>
        <div className="flex items-center gap-1">
          {badge && <SourceControlIconBadge badge={badge as never} />}
          <ToolbarButton
            icon={<ArrowDownToLine className="size-3" />}
            label="Fetch"
            onClick={onFetch}
            busy={busyAction === "fetch"}
            success={successAction === "fetch"}
            disabled={Boolean(busyAction && busyAction !== "fetch")}
          />
          <ToolbarButton
            icon={<GitPullRequestArrow className="size-3" />}
            label="Pull"
            onClick={onPull}
            busy={busyAction === "pull"}
            success={successAction === "pull"}
            disabled={Boolean(busyAction && busyAction !== "pull")}
          />
          <ToolbarButton
            icon={<ArrowUp className="size-3" />}
            label="Push"
            onClick={onPush}
            busy={busyAction === "push"}
            success={successAction === "push"}
            disabled={Boolean(busyAction && busyAction !== "push")}
          />
        </div>
      </header>
      <div className="min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-3">{children}</div>
    </aside>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  busy = false,
  success = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  busy?: boolean;
  success?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy || !onClick}
      onClick={onClick}
      className={cn(
        "text-muted-foreground transition-[color,background-color,transform] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] hover:bg-secondary/50 hover:text-foreground",
        busy && "text-foreground",
        success && "text-[var(--git-added)]",
      )}
    >
      {busy ? (
        <Loader2 className="size-3 animate-spin" />
      ) : success ? (
        <Check className="size-3" />
      ) : (
        icon
      )}
    </Button>
  );
}

function CollapsibleSection({
  label,
  count,
  action,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  count?: number;
  action?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5" aria-label={label.toLowerCase()}>
      <div className="flex w-full items-center justify-between gap-1 rounded px-1 py-0.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-1 rounded transition-colors duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] hover:bg-secondary/30"
        >
          <ChevronDown
            className={cn(
              "size-3 text-muted-foreground transition-transform duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] motion-reduce:transition-none",
              expanded ? "rotate-0" : "-rotate-90",
            )}
          />
          <h3 className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">
            {label}
            {typeof count === "number" && count > 0 && (
              <span className="inline-flex items-center justify-center rounded-[4px] bg-[var(--git-badge)] px-1.5 text-[9px] font-medium leading-[1.4] text-[var(--git-badge-foreground)]">
                {count}
              </span>
            )}
          </h3>
        </button>
        {action}
      </div>
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity] duration-[var(--duration-ui-panel-show)] ease-[var(--ease-out)] motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 min-w-0">{children}</div>
      </div>
    </section>
  );
}

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
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-transparent",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      {label}
    </button>
  );
}

function FileRow({
  file,
  staged,
  expanded,
  busyKind,
  onStage,
  onUnstage,
  onDiscard,
  onToggleDiff,
}: {
  file: SourceControlFileStatus;
  staged?: boolean;
  expanded?: boolean;
  busyKind?: "stage" | "unstage" | "discard" | null;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onToggleDiff?: () => void;
}) {
  const code = staged ? file.indexStatus : file.worktreeStatus ?? file.indexStatus;
  const rowBusy = Boolean(busyKind);
  return (
    <div className="group/file flex items-center gap-1 px-1 py-0.5">
      <span
        className={cn(
          "w-4 shrink-0 text-center font-mono text-[10px]",
          statusColorClass(code),
        )}
        title={code ?? ""}
      >
        {statusCodeGlyph(code)}
      </span>
      <button
        type="button"
        aria-expanded={expanded ?? false}
        className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-xs"
        title={file.path}
        onClick={onToggleDiff}
      >
        {file.path}
      </button>
      {(file.additions !== null || file.deletions !== null) && !file.binary && (
        <span className="shrink-0 font-mono text-[10px]">
          <span className="text-[var(--git-added)]">+{file.additions ?? 0}</span>{" "}
          <span className="text-[var(--git-deleted)]">−{file.deletions ?? 0}</span>
        </span>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {staged ? (
          <IconButton
            label="Unstage"
            busy={busyKind === "unstage"}
            disabled={rowBusy && busyKind !== "unstage"}
            onClick={onUnstage}
          >
            <span className="text-xs">−</span>
          </IconButton>
        ) : (
          <IconButton
            label="Stage"
            busy={busyKind === "stage"}
            disabled={rowBusy && busyKind !== "stage"}
            onClick={onStage}
          >
            <Plus className="size-3" />
          </IconButton>
        )}
        {!staged && (
          <IconButton
            label="Discard"
            busy={busyKind === "discard"}
            disabled={rowBusy && busyKind !== "discard"}
            onClick={onDiscard}
          >
            <RotateCcw className="size-3" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  busy = false,
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy || !onClick}
      className={cn(
        "text-muted-foreground transition-[color,transform] duration-[var(--duration-ui-fast)] ease-[var(--ease-out)] hover:text-foreground",
        busy && "text-foreground",
      )}
      onClick={onClick}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : children}
    </Button>
  );
}

function DiscardConfirm({
  file,
  open,
  onOpenChange,
  onConfirm,
}: {
  file: SourceControlFileStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[320px] flex-col gap-3 p-4">
        <SheetHeader>
          <SheetTitle>Discard changes?</SheetTitle>
          <SheetDescription>
            This will discard local changes to{" "}
            <span className="font-mono">{file?.path}</span>. This cannot be
            undone.
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Trash2 className="size-3.5" />
          <span>Untracked files will be moved to trash.</span>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose render={<Button variant="ghost" size="sm">Cancel</Button>} />
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Discard
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function statusColorClass(
  code:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "copied"
    | "type-changed"
    | "untracked"
    | "ignored"
    | "conflicted"
    | null,
): string {
  switch (code) {
    case "added":
      return "text-[var(--git-added)]";
    case "modified":
      return "text-[var(--git-modified)]";
    case "deleted":
      return "text-[var(--git-deleted)]";
    case "renamed":
    case "copied":
      return "text-[var(--git-renamed)]";
    case "type-changed":
      return "text-[var(--git-modified)]";
    case "untracked":
      return "text-[var(--git-untracked)]";
    case "ignored":
      return "text-[var(--git-ignored)]";
    case "conflicted":
      return "text-[var(--git-conflict)]";
    default:
      return "text-muted-foreground";
  }
}

function statusCodeGlyph(
  code:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "copied"
    | "type-changed"
    | "untracked"
    | "ignored"
    | "conflicted"
    | null,
): string {
  switch (code) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "type-changed":
      return "T";
    case "untracked":
      return "?";
    case "ignored":
      return "!";
    case "conflicted":
      return "U";
    default:
      return " ";
  }
}

/** Files with working-tree changes that are not fully staged. */
function filesWithWorktreeChanges(
  snapshot: SourceControlRepositorySnapshot | undefined,
): SourceControlFileStatus[] {
  if (!snapshot) return [];
  return snapshot.files.filter(
    (f) =>
      f.worktreeStatus !== null &&
      f.worktreeStatus !== "ignored" &&
      !(f.worktreeStatus === "untracked" && f.indexStatus === "added"),
  );
}

/** Files present in the index (staged). */
function filesWithIndexStatus(
  snapshot: SourceControlRepositorySnapshot | undefined,
): SourceControlFileStatus[] {
  if (!snapshot) return [];
  return snapshot.files.filter((f) => f.indexStatus !== null);
}
