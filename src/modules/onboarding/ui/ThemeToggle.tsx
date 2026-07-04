import { useTheme } from "./ThemeProvider";

function SunIcon() {
  return (
    <svg
      className="onboarding-theme-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="onboarding-theme-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const label = mode === "dark" ? "Light" : "Dark";

  return (
    <button
      type="button"
      className="onboarding-theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${label.toLowerCase()} mode`}
    >
      {mode === "dark" ? <SunIcon /> : <MoonIcon />}
      <span>{label}</span>
    </button>
  );
}
