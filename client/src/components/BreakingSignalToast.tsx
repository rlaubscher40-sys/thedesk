/**
 * Bottom-right toast that surfaces today's top signal — the first item from
 * the daily feed if there is one. Dismissed by the user, then quiet for the
 * rest of the day.
 */
import { useEffect, useState } from "react";
import { Radio, X } from "lucide-react";
import { Link } from "wouter";
import { getSydneyIsoDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "thedesk:breaking-dismissed-date";

export function BreakingSignalToast() {
  const today = getSydneyIsoDate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === today);
  }, [today]);

  const { data: items } = trpc.feed.getByDate.useQuery(
    { date: today },
    { enabled: !dismissed, staleTime: 60_000 }
  );

  if (dismissed) return null;
  const top = items?.[0];
  if (!top) return null;

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, today);
    setDismissed(true);
  }

  return (
    <div
      role="status"
      aria-label="Today's top signal"
      className="hidden md:flex fixed bottom-6 right-6 z-40 max-w-sm panel p-4 rounded shadow-xl items-start gap-3"
    >
      <div className="h-7 w-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
        <Radio className="h-3.5 w-3.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="overline mb-1">Today's top signal</p>
        <Link
          href={`/story/${top.id}`}
          className="text-sm font-medium leading-snug line-clamp-2 hover:text-amber-300 transition-colors"
        >
          {top.title}
        </Link>
        <p className="text-xs text-[var(--color-fg-muted)] mt-1 line-clamp-2">{top.summary}</p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
