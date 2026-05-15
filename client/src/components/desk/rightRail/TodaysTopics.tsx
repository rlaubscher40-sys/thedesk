/**
 * Today's Topics rail card — category name + glowing progress bar + count.
 * "Browse all topics →" link at the bottom routes to /search (the Archive
 * page took over from the dedicated Topics index).
 */
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { topics } from "@/data/editions/2026-05-15";
import { categoryColour } from "@/lib/category";
import { RailPanel } from "./RailPanel";

export function TodaysTopics() {
  const max = Math.max(...topics.map((t) => t.count), 1);

  return (
    <RailPanel overline="Today's topics">
      <ul className="space-y-3.5">
        {topics.map((t) => {
          const widthPct = (t.count / max) * 100;
          const colour = categoryColour(t.category);
          return (
            <li key={t.category}>
              <Link href={`/topics/${t.category}`} className="group block">
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
      <Link
        href="/search"
        className="inline-flex items-center gap-1.5 overline-amber mt-5 hover:text-amber-200 transition-colors"
      >
        Browse all topics
        <ArrowRight className="h-3 w-3" />
      </Link>
    </RailPanel>
  );
}
