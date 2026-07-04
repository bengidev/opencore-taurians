import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyThemeToDocument, nextThemeMode, type ThemeMode } from "../domain/onboardingTheme";
import {
  defaultThemeRepository,
  type ThemeRepository,
} from "../infrastructure/onboardingThemeRepository";
import { ThemeContext } from "./onboardingThemeContext";

interface ThemeProviderProps {
  children: ReactNode;
  repository?: ThemeRepository;
}

export function ThemeProvider({
  children,
  repository = defaultThemeRepository,
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => repository.load());

  useEffect(() => {
    applyThemeToDocument(mode);
    repository.save(mode);
  }, [mode, repository]);

  const toggle = useCallback(() => {
    setMode((current) => nextThemeMode(current));
  }, []);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
