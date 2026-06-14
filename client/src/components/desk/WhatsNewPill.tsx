/**
 * "X new since you were last here" strip that sits at the top of the
 * Daily Feed. Uses localStorage to remember the last visit timestamp and
 * counts stories whose `createdAt` is newer.
 *
 * Hidden on the very first visit (no prior timestamp) and when there's
 * nothing new, there's no point shouting "0 new".
 */
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
    // Restrained neutral chip — a passive marker, not an action, so it no
    // longer wears the amber wash that's reserved for the brand and primary
    // CTAs. A single small amber dot is the only accent: enough to read as
    // "new" without competing with the masthead and stories around it.
    <div className="panel inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
      <span
        className="font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)]"
        style={{ fontSize: "10px" }}
      >
        {newCount} new
      </span>
      <span className="text-[var(--color-fg-subtle)] hidden sm:inline">
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
