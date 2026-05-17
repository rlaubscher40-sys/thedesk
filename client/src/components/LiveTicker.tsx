/**
 * Top scrolling ticker. Pulls today's live feed headlines and runs them
 * across the top of the page as a "what's moving today" strip.
 *
 *   ● LIVE  · Item · Item · Item · …
 *
 * Renders the list twice for seamless wrap-around (CSS keyframe
 * translates by 50%). Paused on hover. Hidden when there's nothing in
 * the feed — never falls back to seed placeholders since stale ticker
 * items in a "LIVE" strip is worse than no ticker at all.
 */
import { useMemo } from "react";
import { categoryColour } from "@/lib/category";
import { useFilteredFeed } from "@/lib/useFilteredFeed";
import { trpc } from "@/lib/trpc";

type TickerItem = { category: string | null; label: string };

export function LiveTicker() {
  const feedQuery = trpc.feed.getByDate.useQuery(undefined, {
    staleTime: 60_000,
  });

  const filteredFeed = useFilteredFeed(feedQuery.data ?? []);
  const items = useMemo<TickerItem[]>(() => {
    return filteredFeed.slice(0, 12).map((it) => ({
      category: it.category ?? null,
      // Truncate hard so a long headline doesn't choke the scroll.
      label: it.title.length > 110 ? `${it.title.slice(0, 110).trim()}…` : it.title,
    }));
  }, [filteredFeed]);

  if (items.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg-deep)] group"
      style={{ height: "30px" }}
      aria-label="Live intelligence ticker"
    >
      <div className="absolute inset-y-0 left-0 z-20 flex items-center gap-2 px-4 bg-[var(--color-bg-deep)] border-r border-[var(--color-border)] shrink-0">
        <span className="live-dot" aria-hidden="true" />
        <span className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          Live
        </span>
      </div>
      <div
        className="absolute inset-y-0 left-[100px] right-0 overflow-hidden flex items-center"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, black 4%, black 96%, transparent)",
        }}
      >
        <div
          className="ticker-track inline-flex items-center whitespace-nowrap text-sm font-serif italic text-[var(--color-fg-muted)] group-hover:[animation-play-state:paused]"
          style={{ willChange: "transform" }}
        >
          {[0, 1].map((loop) => (
            <span key={loop} className="inline-flex items-center">
              {items.map((item, i) => (
                <span key={`${loop}-${i}`} className="inline-flex items-center pr-6">
                  {item.category && (
                    <span
                      className="font-mono uppercase tracking-[0.18em] mr-2.5"
                      style={{ color: categoryColour(item.category), fontSize: "9px" }}
                    >
                      {item.category}
                    </span>
                  )}
                  <span>{item.label}</span>
                  <span className="text-[var(--color-fg-subtle)] mx-3" aria-hidden="true">
                    ·
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
