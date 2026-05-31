/**
 * "This week's talking points" — all partner-angle stories from
 * Monday to today, formatted for a quick pre-call skim.
 *
 * Shows only stories with both sayThis and partnerTag, grouped by
 * feed date. A "Copy talking points" button lets the reader paste
 * the week's conversation starters into their notes in one click.
 */
import { useMemo, useState } from "react";
import { CalendarDays, CheckCheck, ClipboardList, Copy } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { DailyFeedItem } from "@shared/types";
import { categoryColour } from "@/lib/category";
import { getSydneyIsoDate } from "@/lib/date";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { PartnerTagBlock } from "@/components/feed/PartnerTagBlock";

function formatWeekdayDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function weekRangeLabel(items: DailyFeedItem[]): string {
  if (items.length === 0) return "";
  const dates = [...new Set(items.map((i) => i.feedDate))].sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  if (first === last) return formatWeekdayDate(first);
  const firstFmt = new Date(`${first}T12:00:00Z`).toLocaleString("en-AU", {
    day: "numeric", month: "long", timeZone: "UTC",
  });
  const lastFmt = new Date(`${last}T12:00:00Z`).toLocaleString("en-AU", {
    day: "numeric", month: "long", timeZone: "UTC",
  });
  return `${firstFmt} – ${lastFmt}`;
}

export default function ThisWeekPage() {
  useDocumentTitle("This Week · Talking Points");
  const today = getSydneyIsoDate();
  const weekQuery = trpc.feed.getByWeek.useQuery(undefined, { staleTime: 60_000 });
  const allItems = weekQuery.data ?? [];

  const [copied, setCopied] = useState(false);

  // Stories with both sayThis and partnerTag are "talking points".
  const talkingPoints = useMemo(
    () => allItems.filter((it) => it.sayThis && it.partnerTag),
    [allItems]
  );

  // Group talking points by feedDate, newest first.
  const byDate = useMemo(() => {
    const map = new Map<string, DailyFeedItem[]>();
    for (const item of talkingPoints) {
      const group = map.get(item.feedDate) ?? [];
      group.push(item);
      map.set(item.feedDate, group);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a));
  }, [talkingPoints]);

  const rangeLabel = weekRangeLabel(allItems);

  async function copyTalkingPoints() {
    if (talkingPoints.length === 0) return;
    const lines: string[] = [
      `Talking points · The Desk · ${rangeLabel}`,
      "",
    ];
    talkingPoints.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`);
      if (item.whyItMatters) lines.push(`   Why it matters: ${item.whyItMatters}`);
      lines.push(`   Say this: "${item.sayThis}"`);
      lines.push("");
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      setCopied(true);
      toast.success("Talking points copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <div className="space-y-10 max-w-3xl mx-auto pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          overline={`The Desk · ${rangeLabel || "This week"}`}
          title="Talking points"
          kicker="Partner angles curated for client conversations. Copy them, adapt them, own them."
        />
        {talkingPoints.length > 0 && (
          <button
            onClick={copyTalkingPoints}
            className="shrink-0 inline-flex items-center gap-2 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors mt-2"
            style={{
              background: copied ? "oklch(0.65 0.14 145 / 15%)" : "oklch(0.78 0.18 70 / 10%)",
              boxShadow: copied
                ? "inset 0 0 0 1px oklch(0.65 0.14 145 / 50%)"
                : "inset 0 0 0 1px oklch(0.78 0.18 70 / 40%)",
              color: copied ? "oklch(0.75 0.14 145)" : "var(--color-amber)",
            }}
          >
            {copied ? <CheckCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy all"}
          </button>
        )}
      </div>

      <SectionErrorBoundary section="This week">
        {weekQuery.isLoading ? (
          <WeekSkeleton />
        ) : talkingPoints.length === 0 ? (
          <EmptyState totalItems={allItems.length} today={today} />
        ) : (
          <div className="space-y-10">
            {/* Summary chip */}
            <div className="flex items-center gap-2.5">
              <ClipboardList className="h-4 w-4 text-amber-400/70 shrink-0" />
              <p className="text-sm text-[var(--color-fg-muted)]">
                <span className="text-amber-300 font-medium">{talkingPoints.length}</span>{" "}
                talking point{talkingPoints.length === 1 ? "" : "s"} from{" "}
                <span className="text-[var(--color-fg)]">{allItems.length}</span> stories this week
              </p>
            </div>

            {byDate.map(([date, items]) => (
              <section key={date}>
                <div className="flex items-baseline gap-6 mb-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays
                      className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0"
                    />
                    <span
                      className="font-mono uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]"
                      style={{ fontSize: "10px" }}
                    >
                      {formatWeekdayDate(date)}
                      {date === today && (
                        <span className="ml-2 text-amber-400/80">· Today</span>
                      )}
                    </span>
                  </div>
                  <span className="block flex-1 h-px bg-[var(--color-border)]" aria-hidden="true" />
                </div>

                <div className="space-y-5">
                  {items.map((item) => (
                    <TalkingPointCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </SectionErrorBoundary>
    </div>
  );
}

function TalkingPointCard({ item }: { item: DailyFeedItem }) {
  const colour = categoryColour(item.category);
  return (
    <article
      className="panel rounded p-5 sm:p-6 space-y-4"
      style={{ borderLeft: `3px solid ${colour}60` }}
    >
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className="font-mono uppercase tracking-[0.18em]"
            style={{ color: colour, fontSize: "10px" }}
          >
            {item.category}
          </span>
          <span className="text-[var(--color-fg-subtle)]" style={{ fontSize: "10px" }}>·</span>
          <span className="font-mono text-[var(--color-fg-subtle)]" style={{ fontSize: "10px" }}>
            {item.source}
          </span>
        </div>
        <Link href={`/story/${item.id}`}>
          <h3 className="font-serif text-lg font-bold leading-snug hover:text-amber-200 transition-colors">
            {item.title}
          </h3>
        </Link>
      </header>

      {item.whyItMatters && (
        <div className="space-y-1">
          <p
            className="font-mono uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]"
            style={{ fontSize: "10px" }}
          >
            Why it matters
          </p>
          <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed italic">
            {item.whyItMatters}
          </p>
        </div>
      )}

      {item.sayThis && (
        <div
          className="rounded px-4 py-3 space-y-1"
          style={{
            background: `${colour}0d`,
            boxShadow: `inset 0 0 0 1px ${colour}30`,
          }}
        >
          <p
            className="font-mono uppercase tracking-[0.16em]"
            style={{ color: colour, fontSize: "10px" }}
          >
            Say this
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
            "{item.sayThis}"
          </p>
        </div>
      )}

      {item.partnerTag && <PartnerTagBlock raw={item.partnerTag} />}
    </article>
  );
}

function EmptyState({ totalItems, today }: { totalItems: number; today: string }) {
  const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return (
    <div className="panel rounded p-8 sm:p-10 text-center">
      <ClipboardList className="h-8 w-8 text-[var(--color-fg-subtle)] mx-auto mb-4" />
      <h2 className="font-serif text-xl font-bold mb-2">
        {isWeekend ? "Weekend — no new stories." : "No talking points yet this week."}
      </h2>
      <p className="text-sm text-[var(--color-fg-muted)] max-w-[50ch] mx-auto leading-relaxed">
        {totalItems > 0
          ? `${totalItems} stories this week are still being enriched with partner angles. Check back shortly.`
          : isWeekend
          ? "The brief runs Monday to Friday. New stories land at 7am AEST each weekday."
          : "The weekly brief hasn't run yet, or this week's stories don't have partner angles yet."}
      </p>
    </div>
  );
}

function WeekSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-3 w-32" />
          <div className="panel rounded p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
