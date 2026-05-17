/**
 * Theme context. Three user-facing modes: "dark", "light", "system".
 * The resolved theme (after applying the system preference when "system"
 * is selected) is applied as a `.light` class on <html> so the CSS
 * overrides in index.css take effect.
 *
 * Persisted to localStorage. System mode listens to prefers-color-scheme
 * and flips live when the OS toggles.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

type Ctx = {
  /** What the user picked. */
  theme: ThemeMode;
  /** What's actually applied (system resolved). */
  resolvedTheme: ResolvedTheme;
  /** What the OS currently prefers. */
  systemPreferred: ResolvedTheme;
  /** Cycle dark → light → system (legacy toggle button). */
  toggleTheme: () => void;
  /** Direct picker for the Settings page. */
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "thedesk:theme";

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "dark";
}

function readSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStored);
  const [systemPreferred, setSystemPreferred] = useState<ResolvedTheme>(readSystem);

  // Listen for OS theme flips so "system" mode follows live.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemPreferred(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemPreferred : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", resolvedTheme === "light");
    root.style.colorScheme = resolvedTheme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [resolvedTheme, theme]);

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);

  // Legacy toggle: cycle dark → light → system → dark.
  const toggleTheme = useCallback(() => {
    setThemeState((t) =>
      t === "dark" ? "light" : t === "light" ? "system" : "dark"
    );
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, systemPreferred, toggleTheme, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
