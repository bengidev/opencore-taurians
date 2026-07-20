import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "../../onboarding/domain/onboardingTheme";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import {
  GUI_SCALE_MAX,
  GUI_SCALE_MIN,
  GUI_SCALE_STEP,
  guiScaleAfterWorkAreaClamp,
  maxGuiScaleForWorkArea,
} from "../../session/domain/sessionGuiScale";
import { readLogicalWorkArea } from "../../session/infrastructure/sessionWorkArea";
import { SHELL_WINDOW_SIZE } from "../../session/infrastructure/sessionWindowController";
import { useSessionStore } from "../../session/state/sessionStore";
import { useShellStore } from "../state/shellStore";
import {
  SHELL_EASE_DRAWER,
  SHELL_EASE_OUT,
  SHELL_HIDE_MS,
  SHELL_SHOW_MS,
  prefersReducedMotion,
  scheduleReveal,
} from "./shellMotion";

const SETTINGS_ENTER_OFFSET_PX = 8;
const SETTINGS_CONTENT_STAGGER_MS = 50;

const THEME_OPTIONS = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
];

function themeOptionButtonClass(value: ThemeMode, selected: boolean) {
  const base = "font-mono text-[11px] uppercase tracking-[0.08em]";
  if (value === "light") {
    return cn(
      base,
      selected
        ? "border-[#e8e8e8] bg-[#f5f5f5] text-black [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#ccc] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#ebebeb] [@media(hover:hover)_and_(pointer:fine)]:hover:text-black"
        : "border-border bg-transparent text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#e8e8e8] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#f5f5f5] [@media(hover:hover)_and_(pointer:fine)]:hover:text-black",
    );
  }
  return cn(
    base,
    selected
      ? "border-[#333] bg-[#111] text-white [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#444] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#1a1a1a] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white"
      : "border-border bg-transparent text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#333] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#111] [@media(hover:hover)_and_(pointer:fine)]:hover:text-white",
  );
}

const PANEL_SETTINGS = [
  {
    id: "settings-left-panel",
    label: "Show left panel",
    description: "Project tree, search, and quick access to settings.",
    selectVisible: (s: ReturnType<typeof useShellStore.getState>) => s.leftVisible,
    setVisible: (visible: boolean) => useShellStore.getState().setLeftVisible(visible),
  },
  {
    id: "settings-right-panel",
    label: "Show right panel",
    description: "Secondary sidebar on the right for tools and context.",
    selectVisible: (s: ReturnType<typeof useShellStore.getState>) => s.rightVisible,
    setVisible: (visible: boolean) => useShellStore.getState().setRightVisible(visible),
  },
  {
    id: "settings-bottom-panel",
    label: "Show bottom panel",
    description: "Status strip along the bottom of the center column.",
    selectVisible: (s: ReturnType<typeof useShellStore.getState>) => s.bottomVisible,
    setVisible: (visible: boolean) => useShellStore.getState().setBottomVisible(visible),
  },
] as const;

function ShellPanelSettingRow({
  id,
  label,
  description,
  selectVisible,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  selectVisible: (s: ReturnType<typeof useShellStore.getState>) => boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const checked = useShellStore(selectVisible);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label
          htmlFor={id}
          className="font-mono text-[11px] uppercase tracking-[0.08em]"
        >
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export function ShellGuiScaleSetting() {
  const guiScale = useSessionStore((s) => s.guiScale);
  const setGuiScale = useSessionStore((s) => s.setGuiScale);
  const [maxFit, setMaxFit] = useState(GUI_SCALE_MAX);
  const percent = `${Math.round(guiScale * 100)}%`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const area = await readLogicalWorkArea();
      if (cancelled || !area) return;
      const next = maxGuiScaleForWorkArea(SHELL_WINDOW_SIZE, area);
      setMaxFit(next);
      const current = useSessionStore.getState().guiScale;
      const clamped = guiScaleAfterWorkAreaClamp(
        current,
        SHELL_WINDOW_SIZE,
        area,
      );
      if (clamped !== current) useSessionStore.getState().setGuiScale(clamped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <Label
          htmlFor="settings-gui-scale"
          className="font-mono text-[11px] uppercase tracking-[0.08em]"
        >
          GUI scale
        </Label>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {percent}
        </span>
      </div>
      <Slider
        id="settings-gui-scale"
        aria-label="GUI scale"
        min={GUI_SCALE_MIN}
        max={maxFit}
        step={GUI_SCALE_STEP}
        value={[guiScale]}
        onValueChange={(value) => {
          const next = Array.isArray(value) ? value[0] : value;
          if (typeof next === "number") setGuiScale(next);
        }}
      />
    </div>
  );
}

export function ShellSettingsPage({ open }: { open: boolean }) {
  const setSettingsOpen = useShellStore((s) => s.setSettingsOpen);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const resetPanelWidths = useShellStore((s) => s.resetPanelWidths);
  const explorerAutoRefresh = useShellStore((s) => s.explorerAutoRefresh);
  const setExplorerAutoRefresh = useShellStore((s) => s.setExplorerAutoRefresh);
  const [mounted, setMounted] = useState(open);
  const [revealed, setRevealed] = useState(open);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(prefersReducedMotion());
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reduceMotion) {
        setRevealed(true);
        return;
      }
      setRevealed(false);
      scheduleReveal(setRevealed);
      return;
    }

    setRevealed(false);
    if (reduceMotion) {
      setMounted(false);
    }
  }, [open, reduceMotion]);

  if (!mounted) return null;

  const overlayDurationMs = open ? SHELL_SHOW_MS : SHELL_HIDE_MS;
  const overlayEase = open ? SHELL_EASE_OUT : SHELL_EASE_DRAWER;
  const showMotion = revealed || reduceMotion;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col bg-background text-foreground motion-reduce:transition-none motion-reduce:blur-none motion-reduce:opacity-100"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{
        pointerEvents: open ? "auto" : "none",
        opacity: showMotion ? 1 : 0,
        filter: showMotion ? "blur(0px)" : "blur(2px)",
        transform: showMotion
          ? "translateY(0px) scale(1)"
          : `translateY(${SETTINGS_ENTER_OFFSET_PX}px) scale(0.98)`,
        transitionProperty: reduceMotion ? "none" : "transform, opacity, filter",
        transitionDuration: reduceMotion ? "0ms" : `${overlayDurationMs}ms`,
        transitionTimingFunction: overlayEase,
      }}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          !open &&
          (event.propertyName === "opacity" || event.propertyName === "transform")
        ) {
          setMounted(false);
        }
      }}
    >
      <header
        className="flex h-9 shrink-0 items-center border-b border-border"
        onClick={() => setSettingsOpen(false)}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Back"
          className="h-9 w-auto justify-start gap-2 rounded-none px-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
          onClick={() => setSettingsOpen(false)}
        >
          <ArrowLeft className="size-3.5 shrink-0" />
          Settings
        </Button>
      </header>
      <div
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 overflow-y-auto p-6 motion-reduce:transition-none motion-reduce:opacity-100"
        style={{
          opacity: showMotion ? 1 : 0,
          transform: showMotion ? "translateY(0px)" : "translateY(4px)",
          transitionProperty: reduceMotion ? "none" : "transform, opacity",
          transitionDuration: reduceMotion ? "0ms" : `${overlayDurationMs}ms`,
          transitionTimingFunction: overlayEase,
          transitionDelay:
            reduceMotion || !open
              ? "0ms"
              : showMotion
                ? `${SETTINGS_CONTENT_STAGGER_MS}ms`
                : "0ms",
        }}
      >
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Appearance
          </h2>
          <p className="text-sm text-muted-foreground">Choose how OpenCore looks.</p>
          <div className="flex gap-2" role="group" aria-label="Theme">
            {THEME_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={mode === value}
                className={themeOptionButtonClass(value, mode === value)}
                onClick={() => setMode(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <ShellGuiScaleSetting />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Panels
          </h2>
          <p className="text-sm text-muted-foreground">
            Control which parts of the workspace shell are visible.
          </p>
          <div className="flex flex-col gap-4 rounded-[6px] border border-border p-4">
            {PANEL_SETTINGS.map((setting) => (
              <ShellPanelSettingRow
                key={setting.id}
                id={setting.id}
                label={setting.label}
                description={setting.description}
                selectVisible={setting.selectVisible}
                onCheckedChange={setting.setVisible}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start font-mono text-[11px] uppercase tracking-[0.08em]"
            onClick={resetPanelWidths}
          >
            Reset panel widths
          </Button>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Explorer
          </h2>
          <p className="text-sm text-muted-foreground">
            Control how the file tree stays up to date.
          </p>
          <div role="group" aria-label="Explorer auto-refresh">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={explorerAutoRefresh === "live"}
                className="font-mono text-[11px] uppercase tracking-[0.08em]"
                onClick={() => setExplorerAutoRefresh("live")}
              >
                Live updates
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-pressed={explorerAutoRefresh === "on-activate"}
                className="font-mono text-[11px] uppercase tracking-[0.08em]"
                onClick={() => setExplorerAutoRefresh("on-activate")}
              >
                On project switch
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
