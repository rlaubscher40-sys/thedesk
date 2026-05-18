/**
 * Theme + reading-size context.
 *
 * Theme has three user-facing modes: dark / light / system. The
 * resolved theme is applied as a `.light` class on <html> (CSS in
 * index.css picks it up).
 *
 * Reading size has two values: default / comfortable. Comfortable
 * applies a `.comfortable` class on <html> which scales the root
 * font-size up so every rem-based body, overline, and headline lifts
 * proportionally — without disturbing pixel-perfect chrome (lockup,
 * icons, hairline rules) measured in absolute px.
 *
 * Both prefs persist to localStorage. The inline script at the top of
 * client/index.html mirrors this logic so the right classes are on
 * <html> before paint (no flash).
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
export type ReadingSize = "default" | "comfortable";

type Ctx = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  systemPreferred: ResolvedTheme;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  readingSize: ReadingSize;
  setReadingSize: (size: ReadingSize) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "thedesk:theme";
const READING_SIZE_KEY = "thedesk:reading-size";

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "dark";
}

function readStoredReadingSize(): ReadingSize {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(READING_SIZE_KEY);
  return stored === "comfortable" ? "comfortable" : "default";
}

function readSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStored);
  const [systemPreferred, setSystemPreferred] = useState<ResolvedTheme>(readSystem);
  const [readingSize, setReadingSizeState] = useState<ReadingSize>(readStoredReadingSize);

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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("comfortable", readingSize === "comfortable");
    window.localStorage.setItem(READING_SIZE_KEY, readingSize);
  }, [readingSize]);

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);
  const setReadingSize = useCallback(
    (next: ReadingSize) => setReadingSizeState(next),
    []
  );

  // Legacy toggle: cycle dark → light → system → dark.
  const toggleTheme = useCallback(() => {
    setThemeState((t) =>
      t === "dark" ? "light" : t === "light" ? "system" : "dark"
    );
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        systemPreferred,
        toggleTheme,
        setTheme,
        readingSize,
        setReadingSize,
      }}
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
