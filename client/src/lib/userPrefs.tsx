/**
 * Reader preferences — topic interest filters and notification choices.
 * Stored entirely in localStorage for now (no auth wall, no server
 * round-trip). When real subscriber accounts arrive these flips can
 * migrate to a subscribers.prefs JSON column without changing the API.
 *
 * Two modes for topic interest:
 *   - allowlist: only show the categories the user opted in to
 *   - "all": no filtering (default)
 *
 * The Today / Archive pages read `useUserPrefs().isCategoryAllowed(cat)`
 * to honour the choice. Notification flags are stub-only until email
 * delivery is wired (Resend / Postmark).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "thedesk:prefs";

export type NotificationPrefs = {
  /** Daily brief email at 7am AEST. */
  daily: boolean;
  /** Weekly edition email Sunday 7am AEST. */
  weekly: boolean;
  /** Breaking-news pulses when a high-priority story drops mid-day. */
  breaking: boolean;
};

export type UserPrefs = {
  /** Categories the user wants to see. Empty array = "no filter". */
  topicAllowlist: string[];
  notifications: NotificationPrefs;
};

const DEFAULT_PREFS: UserPrefs = {
  topicAllowlist: [],
  notifications: { daily: true, weekly: true, breaking: false },
};

type Ctx = {
  prefs: UserPrefs;
  setTopicAllowlist: (categories: string[]) => void;
  toggleNotification: (key: keyof NotificationPrefs) => void;
  isCategoryAllowed: (category: string) => boolean;
  reset: () => void;
};

const PrefsContext = createContext<Ctx | null>(null);

function read(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UserPrefs>;
    return {
      topicAllowlist: Array.isArray(parsed.topicAllowlist)
        ? parsed.topicAllowlist
        : DEFAULT_PREFS.topicAllowlist,
      notifications: {
        ...DEFAULT_PREFS.notifications,
        ...(parsed.notifications ?? {}),
      },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function UserPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPrefs>(() => read());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setTopicAllowlist = useCallback((categories: string[]) => {
    setPrefs((p) => ({ ...p, topicAllowlist: categories }));
  }, []);

  const toggleNotification = useCallback((key: keyof NotificationPrefs) => {
    setPrefs((p) => ({
      ...p,
      notifications: {
        ...p.notifications,
        [key]: !p.notifications[key],
      },
    }));
  }, []);

  const isCategoryAllowed = useCallback(
    (category: string) => {
      if (prefs.topicAllowlist.length === 0) return true;
      return prefs.topicAllowlist.includes(category.toUpperCase());
    },
    [prefs.topicAllowlist]
  );

  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  const value = useMemo(
    () => ({ prefs, setTopicAllowlist, toggleNotification, isCategoryAllowed, reset }),
    [prefs, setTopicAllowlist, toggleNotification, isCategoryAllowed, reset]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function useUserPrefs(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("useUserPrefs must be used inside UserPrefsProvider");
  return ctx;
}

/** Canonical set of categories the user can opt in / out of. */
export const SELECTABLE_CATEGORIES = [
  "PROPERTY",
  "MACRO",
  "POLICY",
  "MARKETS",
  "GEOPOLITICS",
  "ECONOMICS",
  "AI",
  "TECH",
  "SCIENCE",
] as const;
