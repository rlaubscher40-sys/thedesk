/**
 * Reading-streak tracker. Counts consecutive Sydney-time days the user
 * has loaded the Today page. Persisted in localStorage.
 *
 * Rules:
 *   · Same day as last visit — no change.
 *   · Exactly one day after last visit — streak + 1.
 *   · Any other gap — streak resets to 1.
 *
 * Returns the current streak, longest streak, and a "badge tier" so the
 * sidebar pill can change colour at 3 / 7 / 14 / 30 days.
 */
import { useEffect, useState } from "react";
import { getSydneyIsoDate } from "@/lib/date";

const STORAGE_KEY = "thedesk:streak";

type Stored = {
  lastVisit: string; // YYYY-MM-DD (Sydney)
  current: number;
  longest: number;
};

function read(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

function write(s: Stored) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`);
  const b = new Date(`${bIso}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type StreakTier = "none" | "starter" | "weekly" | "fortnight" | "monthly";

function tierFor(current: number): StreakTier {
  if (current >= 30) return "monthly";
  if (current >= 14) return "fortnight";
  if (current >= 7) return "weekly";
  if (current >= 3) return "starter";
  return "none";
}

export function useStreak() {
  const [state, setState] = useState<Stored>(() => {
    const stored = read();
    return stored ?? { lastVisit: "", current: 0, longest: 0 };
  });

  useEffect(() => {
    const today = getSydneyIsoDate();
    const stored = read();
    if (stored?.lastVisit === today) {
      // Same-day revisit — no change.
      setState(stored);
      return;
    }

    let nextCurrent = 1;
    if (stored?.lastVisit) {
      const gap = daysBetween(stored.lastVisit, today);
      if (gap === 1) nextCurrent = stored.current + 1;
      else if (gap === 0) nextCurrent = stored.current;
      else nextCurrent = 1;
    }
    const next: Stored = {
      lastVisit: today,
      current: nextCurrent,
      longest: Math.max(stored?.longest ?? 0, nextCurrent),
    };
    write(next);
    setState(next);
  }, []);

  return {
    current: state.current,
    longest: state.longest,
    tier: tierFor(state.current),
  };
}
