/**
 * Today's Topics rail card, counts categories across today's live feed
 * items. Each row: category label + glowing progress bar (normalised
 * against the max count) + count.
 *
 * Falls back to the hand-curated seed topics only in demo mode (no
 * DATABASE_URL). With a real DB but zero items, renders an empty state
 * so the editor knows the feed is empty rather than seeing stale counts.
 */
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { topics as seedTopics } from "@/data/editions/2026-05-15";
import { categoryColour } from "@/lib/category";
import { useFilteredFeed } from "@/lib/useFilteredFeed";
import { trpc } from "@/lib/trpc";
import { RailPanel } from "./RailPanel";

type CountedCategory = {
  category: string;
  label: string;
  count: number;
};

export function TodaysTopics() {
  const feedQuery = trpc.feed.getByDate.useQuery(undefined, {
    staleTime: 60_000,
  });
  const demoModeQuery = trpc.system.demoMode.useQuery();
  const isDemo = demoModeQuery.data?.demoMode ?? false;

  const filteredItems = useFilteredFeed(feedQuery.data ?? []);
  const liveCounts = useMemo<CountedCategory[]>(() => {
    const counts = new Map<string, number>();
    for (const item of filteredItems) {
      const k = (item.category ?? "OTHER").toUpperCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, label: category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredItems]);

  const hasLive = liveCounts.length > 0;
  // Demo deploys (no DB) keep the seed display so the page doesn't feel
  // empty; production with a real DB but zero items renders an empty
  // state rather than misleading seed counts.
  const source: CountedCategory[] = hasLive
    ? liveCounts
    : isDemo
      ? seedTopics.map((t) => ({
          category: t.category,
          label: t.label,
          count: t.count,
        }))
      : [];
  const max = Math.max(...source.map((t) => t.count), 1);

  return (
    <RailPanel overline="Today's topics">
      {source.length === 0 ? (
        <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
          Feed is empty. Re-run the Daily Feed workflow to populate today's
          topics.
        </p>
      ) : (
        <ul className="space-y-3.5">
          {source.map((t) => {
            const widthPct = (t.count / max) * 100;
            const colour = categoryColour(t.category);
            return (
              <li key={t.category}>
                <Link
                  href={`/archive?cat=${encodeURIComponent(t.category)}`}
                  className="group block"
                >
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span
                      className="overline group-hover:text-amber-200 transition-colors"
                      style={{ color: colour }}
                    >
                      {t.label}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-fg-muted)]">
                      {t.count}
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden bg-white/[0.04]">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${widthPct}%`,
                        background: colour,
                        boxShadow: `0 0 10px 0 ${colour}55`,
                      }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/archive"
        className="inline-flex items-center gap-1.5 overline-amber mt-5 hover:text-amber-200 transition-colors"
      >
        Browse all topics
        <ArrowRight className="h-3 w-3" />
      </Link>
    </RailPanel>
  );
}
