/**
 * Tracks the user's last visit to a section in localStorage so we can show
 * "X new since you were last here" without needing accounts or server state.
 *
 * `getLastVisit()` returns the previous timestamp on first call within a
 * session, then immediately stamps a new one. That means the count is
 * computed once per page mount — it doesn't keep dropping to zero as you
 * scroll.
 */
import { useEffect, useState } from "react";

const PREFIX = "thedesk:lastVisit:";

export function useLastVisit(key: string): Date | null {
  // Read once on mount; if absent or unparseable, treat as null.
  const [previous, setPrevious] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = PREFIX + key;
    const stored = window.localStorage.getItem(storageKey);
    let prev: Date | null = null;
    if (stored) {
      const ms = Number(stored);
      if (Number.isFinite(ms) && ms > 0) prev = new Date(ms);
    }
    setPrevious(prev);
    // Stamp now AFTER reading the previous value.
    window.localStorage.setItem(storageKey, String(Date.now()));
  }, [key]);

  return previous;
}
