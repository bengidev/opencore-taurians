import { useEffect, type ReactNode } from "react";
import { applyThemeToDocument } from "../domain/onboardingTheme";
import { ThemeContext } from "./onboardingThemeContext";
import { useThemeStore } from "../state/onboardingThemeStore";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  useEffect(() => {
    applyThemeToDocument(mode);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
