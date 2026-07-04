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
      className="px-3"
      onClick={toggle}
      aria-label={`Switch to ${label.toLowerCase()} mode`}
    >
      {mode === "dark" ? (
        <SunIcon data-icon="inline-start" />
      ) : (
        <MoonIcon data-icon="inline-start" />
      )}
      {label}
    </Button>
  );
}
