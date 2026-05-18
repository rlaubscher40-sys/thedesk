/**
 * "X new since you were last here" strip that sits at the top of the
 * Daily Feed. Uses localStorage to remember the last visit timestamp and
 * counts stories whose `createdAt` is newer.
 *
 * Hidden on the very first visit (no prior timestamp) and when there's
 * nothing new, there's no point shouting "0 new".
 */
import { Sparkles } from "lucide-react";
import { useLastVisit } from "@/lib/useLastVisit";

export function WhatsNewPill({
  storyDates,
  storageKey = "today",
}: {
  /** Array of createdAt-equivalent timestamps for the stories on the page. */
  storyDates: Array<Date | string | number>;
  storageKey?: string;
}) {
  const lastVisit = useLastVisit(storageKey);
  if (!lastVisit) return null;

  const ago = Date.now() - lastVisit.getTime();
  // If they were here in the last 90 seconds it's basically a reload, don't
  // call that out. (The page mount already overwrote the timestamp.)
  if (ago < 90_000) return null;

  const cutoff = lastVisit.getTime();
  const newCount = storyDates.filter((d) => {
    const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
    return Number.isFinite(t) && t > cutoff;
  }).length;
  if (newCount === 0) return null;

  return (
    <div
      className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-xs"
      style={{
        background: "oklch(0.78 0.18 70 / 8%)",
        boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 28%)",
      }}
    >
      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
      <span className="font-mono uppercase tracking-[0.18em] text-amber-300/90" style={{ fontSize: "10px" }}>
        {newCount} new
      </span>
      <span className="text-[var(--color-fg-muted)]">
        since you were last here {formatAgo(ago)}
      </span>
    </div>
  );
}

function formatAgo(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return lastVisitFallback(ms);
}

function lastVisitFallback(ms: number): string {
  const d = new Date(Date.now() - ms);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
