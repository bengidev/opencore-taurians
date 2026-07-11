import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { ThemeMode } from "../../onboarding/domain/onboardingTheme";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { useShellStore } from "../state/shellStore";

type ShellSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ShellSettingsSheet({ open, onOpenChange }: ShellSettingsSheetProps) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const leftVisible = useShellStore((s) => s.leftVisible);
  const rightVisible = useShellStore((s) => s.rightVisible);
  const setLeftVisible = useShellStore((s) => s.setLeftVisible);
  const setRightVisible = useShellStore((s) => s.setRightVisible);
  const resetPanelWidths = useShellStore((s) => s.resetPanelWidths);

  const setTheme = (next: ThemeMode) => setMode(next);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(100vw,24rem)]">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Appearance and shell layout preferences.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-4">
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Appearance
            </h2>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <Button
                  key={theme}
                  type="button"
                  size="sm"
                  variant={mode === theme ? "default" : "outline"}
                  className="font-mono text-[11px] uppercase tracking-[0.08em]"
                  onClick={() => setTheme(theme)}
                  aria-label={theme === "light" ? "Light" : "Dark"}
                >
                  {theme}
                </Button>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Panels
            </h2>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="settings-left-panel">Show left panel</Label>
              <Switch
                id="settings-left-panel"
                checked={leftVisible}
                onCheckedChange={setLeftVisible}
                aria-label="Show left panel"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="settings-right-panel">Show right panel</Label>
              <Switch
                id="settings-right-panel"
                checked={rightVisible}
                onCheckedChange={setRightVisible}
                aria-label="Show right panel"
              />
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
