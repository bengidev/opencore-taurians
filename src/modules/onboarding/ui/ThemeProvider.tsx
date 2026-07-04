import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyThemeToDocument, nextThemeMode, type ThemeMode } from "../domain/theme";
import {
  defaultThemeRepository,
  type ThemeRepository,
} from "../infrastructure/themeRepository";

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

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

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
