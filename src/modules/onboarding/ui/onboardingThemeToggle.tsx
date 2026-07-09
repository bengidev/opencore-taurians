import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./onboardingThemeContext";

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const label = mode === "dark" ? "Light" : "Dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="onboarding-label onboarding-theme-toggle h-8 min-h-8 gap-1.5 rounded-[6px] px-3"
      onClick={toggle}
      aria-label={`Switch to ${label.toLowerCase()} mode`}
    >
      {mode === "dark" ? (
        <SunIcon data-icon="inline-start" className="stroke-[1.5]" />
      ) : (
        <MoonIcon data-icon="inline-start" className="stroke-[1.5]" />
      )}
      {label}
    </Button>
  );
}
