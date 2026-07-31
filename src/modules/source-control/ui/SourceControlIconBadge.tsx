import type { SourceControlBadge, SourceControlBadgeKind } from "../domain/sourceControlIconBadge";

const KIND_STYLES: Record<SourceControlBadgeKind, string> = {
  none: "",
  conflict: "bg-destructive/10 text-destructive",
  diverged: "bg-primary/10 text-primary",
  dirty: "bg-amber-500/10 text-amber-600",
  ahead: "bg-emerald-500/10 text-emerald-600",
  behind: "bg-blue-500/10 text-blue-600",
};

interface SourceControlIconBadgeProps {
  badge: SourceControlBadge;
}

export function SourceControlIconBadge({ badge }: SourceControlIconBadgeProps) {
  if (badge.kind === "none" || badge.count <= 0) {
    return null;
  }

  const label = badge.count >= 99 ? "99+" : String(badge.count);

  return (
    <span
      aria-label={`${badge.kind}: ${label}`}
      className={[
        "inline-flex min-w-[1rem] items-center justify-center rounded-[4px] px-1.5 py-0 text-[9px] font-medium leading-3",
        KIND_STYLES[badge.kind],
      ].join(" ")}
    >
      {label}
    </span>
  );
}
