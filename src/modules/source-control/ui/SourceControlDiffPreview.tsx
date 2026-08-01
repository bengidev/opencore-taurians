import { cn } from "@/lib/utils";

export interface SourceControlDiffPreviewProps {
  patch: string;
  truncated: boolean;
  error?: string | null;
  className?: string;
  /** Hide per-file path headers when the parent already shows the path. */
  hideFileHeaders?: boolean;
}

export interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldNumber: number | null;
  newNumber: number | null;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const DIFF_GIT_RE = /^diff --git a\/(.+) b\/(.+)$/;
const PLUSPLUSPLUS_RE = /^\+\+\+ /;
const MINUSMINUS_RE = /^--- /;

function inferPath(lines: string[], startIndex: number): string {
  for (let i = startIndex; i < Math.min(startIndex + 4, lines.length); i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const match = DIFF_GIT_RE.exec(line);
    if (match) {
      return match[2] ?? match[1];
    }
  }
  for (let i = startIndex; i < Math.min(startIndex + 6, lines.length); i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.startsWith("+++ b/")) {
      return line.slice(6);
    }
    if (line.startsWith("+++ ") && !line.startsWith("+++ /dev/null")) {
      return line.slice(4);
    }
  }
  return "unknown";
}

function createFile(path: string): DiffFile {
  return { path, additions: 0, deletions: 0, hunks: [] };
}

export function parseUnifiedDiff(patch: string): DiffFile[] {
  if (patch.length === 0) return [];

  const lines = patch.split("\n");
  const files: DiffFile[] = [];

  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];

    if (rawLine === undefined) {
      i++;
      continue;
    }

    if (rawLine.startsWith("diff --git")) {
      const match = DIFF_GIT_RE.exec(rawLine);
      const path = match ? (match[2] ?? match[1]) : inferPath(lines, i);
      currentFile = createFile(path);
      files.push(currentFile);
      currentHunk = null;
      i++;
      continue;
    }

    if (PLUSPLUSPLUS_RE.test(rawLine) || MINUSMINUS_RE.test(rawLine) || rawLine.startsWith("index ")) {
      if (currentFile === null) {
        currentFile = createFile(inferPath(lines, i));
        files.push(currentFile);
      }
      i++;
      continue;
    }

    const hunkMatch = HUNK_HEADER_RE.exec(rawLine);
    if (hunkMatch) {
      if (currentFile === null) {
        currentFile = createFile(inferPath(lines, i));
        files.push(currentFile);
      }
      const oldStart = Number(hunkMatch[1]);
      const newStart = Number(hunkMatch[2]);
      currentHunk = {
        header: rawLine,
        oldStart,
        newStart,
        lines: [],
      };
      currentFile.hunks.push(currentHunk);
      i++;
      continue;
    }

    if (currentHunk === null || currentFile === null) {
      i++;
      continue;
    }

    let type: DiffLine["type"];
    let content: string;

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      type = "add";
      content = rawLine.slice(1);
      currentFile.additions++;
      currentHunk.lines.push({
        type,
        content,
        oldNumber: null,
        newNumber: currentHunk.newStart++,
      });
    } else if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
      type = "remove";
      content = rawLine.slice(1);
      currentFile.deletions++;
      currentHunk.lines.push({
        type,
        content,
        oldNumber: currentHunk.oldStart++,
        newNumber: null,
      });
    } else {
      type = "context";
      content = rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine;
      currentHunk.lines.push({
        type,
        content,
        oldNumber: currentHunk.oldStart++,
        newNumber: currentHunk.newStart++,
      });
    }

    i++;
  }

  return files;
}

function LineNumber({ value }: { value: number | null }) {
  return (
    <span className="inline-block w-12 px-1 text-right text-[10px] tabular-nums text-muted-foreground/70 select-none">
      {value ?? ""}
    </span>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const baseClasses =
    "flex w-max min-w-full font-mono text-[11px] leading-tight whitespace-pre";

  const colorClasses =
    line.type === "add"
      ? "bg-[var(--git-diff-addition)] text-[var(--git-added)]"
      : line.type === "remove"
        ? "bg-[var(--git-diff-deletion)] text-[var(--git-deleted)]"
        : "bg-transparent text-foreground";

  return (
    <div className={cn(baseClasses, colorClasses)}>
      <LineNumber value={line.oldNumber} />
      <LineNumber value={line.newNumber} />
      <span className="flex-1 px-1">
        {line.content.length === 0 ? " " : line.content}
      </span>
    </div>
  );
}

function HunkHeader({ header }: { header: string }) {
  return (
    <div className="flex bg-[var(--git-diff-header)] text-muted-foreground">
      <span className="inline-block w-12 px-1 text-right text-[10px] tabular-nums text-muted-foreground/50 select-none" />
      <span className="inline-block w-12 px-1 text-right text-[10px] tabular-nums text-muted-foreground/50 select-none" />
      <span className="min-w-0 flex-1 overflow-hidden px-1 py-0.5 font-mono text-[11px] leading-tight">
        {header}
      </span>
    </div>
  );
}

function FileSection({
  file,
  hideHeader,
}: {
  file: DiffFile;
  hideHeader?: boolean;
}) {
  return (
    <div className="border-b border-border/50 last:border-b-0">
      {!hideHeader && (
        <div className="flex w-full items-center justify-between bg-secondary/30 px-2 py-1">
          <span className="truncate text-xs font-medium">{file.path}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            <span className="text-[var(--git-added)]">+{file.additions}</span>
            {" "}
            <span className="text-[var(--git-deleted)]">-{file.deletions}</span>
          </span>
        </div>
      )}

      <div>
        {file.hunks.map((hunk, hunkIndex) => (
          <div key={hunkIndex}>
            <HunkHeader header={hunk.header} />
            {hunk.lines.map((line, lineIndex) => (
              <DiffRow key={lineIndex} line={line} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Rich unified-diff renderer styled after VSCode's diff view.
 * Parses a unified patch into per-file sections with hunk headers,
 * dual line-number columns, and color-coded additions/removals.
 */
export function SourceControlDiffPreview({
  patch,
  truncated,
  error,
  className,
  hideFileHeaders = false,
}: SourceControlDiffPreviewProps) {
  const files = parseUnifiedDiff(patch);

  return (
    <div className={cn("flex h-full min-h-0 w-full min-w-0 flex-col", className)}>
      {error ? (
        <div
          role="alert"
          className="m-2 rounded border border-[var(--git-conflict)]/40 bg-[var(--git-conflict-bg)] px-2 py-1.5 text-xs text-[var(--git-conflict)]"
        >
          {error}
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-auto">
          {files.length === 0 ? (
            <div className="p-2 font-mono text-[11px] text-muted-foreground">
              No changes.
            </div>
          ) : (
            files.map((file, index) => (
              <FileSection key={index} file={file} hideHeader={hideFileHeaders} />
            ))
          )}
        </div>
      )}

      {truncated && !error && (
        <p className="shrink-0 border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
          Output truncated
        </p>
      )}
    </div>
  );
}
