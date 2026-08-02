import { memo, useEffect, useRef, useState } from "react";
import { ExplorerPanel } from "../../../explorer";
import { SOURCE_CONTROL_SUITE_RELEASE_ENABLED } from "../../../source-control/domain/sourceControlFeatureAvailability";
import { SourceControlPanel } from "../../../source-control/ui/SourceControlPanel";
import { useProjectStore } from "../../../project/state/projectStore";
import type { RightPanelFeature } from "../../../project/domain/projectTypes";
import {
  prefersReducedMotion,
  scheduleReveal,
  SHELL_EASE_OUT,
  SHELL_SHOW_MS,
} from "../shellMotion";

export interface ShellRightPanelProps {
  sourceControlEnabled?: boolean;
}

const FEATURE_ENTER_OFFSET_PX = 10;

function ShellRightPanelRaw({
  sourceControlEnabled = SOURCE_CONTROL_SUITE_RELEASE_ENABLED,
}: ShellRightPanelProps) {
  const feature = useProjectStore((state) =>
    state.trunks.find((trunk) => trunk.id === state.activeTrunkId)?.restore
      .rightPanelFeature ?? "files",
  );
  const activeFeature: RightPanelFeature =
    sourceControlEnabled && feature === "git" ? "git" : "files";

  const [reduceMotion, setReduceMotion] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [renderedFeature, setRenderedFeature] =
    useState<RightPanelFeature>(activeFeature);
  const prevFeatureRef = useRef(activeFeature);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (activeFeature === prevFeatureRef.current) return;
    prevFeatureRef.current = activeFeature;

    if (reduceMotion) {
      setRenderedFeature(activeFeature);
      setRevealed(true);
      return;
    }

    setRevealed(false);
    setRenderedFeature(activeFeature);
    scheduleReveal(setRevealed);
  }, [activeFeature, reduceMotion]);

  const enterFromRight = renderedFeature === "git";
  const contentOffset = enterFromRight
    ? FEATURE_ENTER_OFFSET_PX
    : -FEATURE_ENTER_OFFSET_PX;
  const showMotion = revealed || reduceMotion;

  return (
    <aside
      aria-label="right panel"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    >
      <div
        key={renderedFeature}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col motion-reduce:translate-x-0 motion-reduce:opacity-100 motion-reduce:transition-none"
        style={{
          opacity: showMotion ? 1 : 0,
          transform: showMotion
            ? "translateX(0px)"
            : `translateX(${contentOffset}px)`,
          transitionProperty: reduceMotion ? "none" : "transform, opacity",
          transitionDuration: reduceMotion ? "0ms" : `${SHELL_SHOW_MS}ms`,
          transitionTimingFunction: SHELL_EASE_OUT,
        }}
      >
        {renderedFeature === "git" ? (
          <SourceControlPanel />
        ) : (
          <ExplorerPanel />
        )}
      </div>
    </aside>
  );
}

export const ShellRightPanel = memo(ShellRightPanelRaw);
