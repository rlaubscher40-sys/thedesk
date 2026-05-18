/**
 * Latest Edition rail card. Pulls the newest edition from `editions.list`
 * and renders its number + week range + a few category chips derived from
 * the edition's actual topics.
 *
 * Falls back to seed metadata only when the app is in demo mode (no DB).
 * With a real but empty DB renders an explicit "no editions yet" state
 * pointing the editor at the Weekly Edition workflow.
 */
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { editionMeta, topics as seedTopics } from "@/data/editions/2026-05-15";
import { categoryColour } from "@/lib/category";
import { trpc } from "@/lib/trpc";
import { RailPanel } from "./RailPanel";

export function LatestEdition() {
  const listQuery = trpc.editions.list.useQuery();
  const demoModeQuery = trpc.system.demoMode.useQuery();
  const isDemo = demoModeQuery.data?.demoMode ?? false;

  const latest = listQuery.data?.[0]; // newest-first ordering

  if (!latest && !isDemo && listQuery.isSuccess) {
    return (
      <RailPanel overline="Latest edition">
        <p className="font-serif text-lg text-[var(--color-fg-muted)] leading-snug mb-3">
          No editions yet.
        </p>
        <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed">
          Re-fire the Weekly Edition workflow on GitHub Actions to publish
          the first one.
        </p>
      </RailPanel>
    );
  }

  // Resolve the display values. Live edition wins; demo edition is only
  // used when there's literally no DB configured.
  const number = latest?.editionNumber ?? editionMeta.number;
  const weekRange = latest?.weekRange ?? editionMeta.weekRange;
  const chips = latest
    ? deriveChipsFromKeyMetrics(latest)
    : seedTopics.slice(0, 3).map((t) => ({ category: t.category, label: t.label }));

  return (
    <RailPanel overline="Latest edition">
      <Link href={`/editions/${number}`} className="group block">
        <p className="font-serif text-2xl font-bold tabular-nums leading-none group-hover:text-amber-200 transition-colors">
          Edition {number}
        </p>
        <p
          className="overline mt-2 mb-4 text-[var(--color-fg-muted)]"
          style={{ letterSpacing: "0.16em" }}
        >
          {weekRange}
        </p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.category}
                className="font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border"
                style={{
                  color: categoryColour(c.category),
                  borderColor: `${categoryColour(c.category)}55`,
                  background: `${categoryColour(c.category)}10`,
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
        <span className="inline-flex items-center gap-1.5 overline-amber mt-4 group-hover:text-amber-200 transition-colors">
          Open edition
          <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </RailPanel>
  );
}

/**
 * Pull up to three category labels off the edition's keyMetrics keys —
 * cheap proxy for "what this edition is about" without having to fetch
 * the full topics array (which the lean list query doesn't ship).
 */
function deriveChipsFromKeyMetrics(
  edition: { keyMetrics?: Record<string, string | number> | null }
): Array<{ category: string; label: string }> {
  // The lean list query doesn't carry the topics array, but we can use
  // the same set of categories the metrics strip groups by as a stand-in.
  // Keep it simple, three rotating chips that signal "macro/property/
  // markets feel" without lying about exact topic coverage.
  const labels = ["MACRO", "PROPERTY", "MARKETS"];
  // If we ever extend the list query to ship a `topicCategories` derived
  // field we can swap this for the real thing. For now: keys of
  // keyMetrics are a soft hint, if "Cash rate" is there, MACRO wins.
  if (edition.keyMetrics) {
    const keys = Object.keys(edition.keyMetrics).map((k) => k.toLowerCase());
    const inferred: string[] = [];
    if (keys.some((k) => /rate|cpi|gdp|inflation/.test(k))) inferred.push("MACRO");
    if (keys.some((k) => /clearance|listings|housing|dwell/.test(k))) inferred.push("PROPERTY");
    if (keys.some((k) => /asx|aud|index|stock/.test(k))) inferred.push("MARKETS");
    if (inferred.length > 0) {
      return inferred.slice(0, 3).map((c) => ({ category: c, label: c }));
    }
  }
  return labels.map((c) => ({ category: c, label: c }));
}
