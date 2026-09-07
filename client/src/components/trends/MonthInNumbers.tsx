/**
 * "The Month in Numbers" — the one series nobody else can run.
 *
 * Every individual figure here is public. What is not public is this basket,
 * sampled daily and kept in one place, which is what makes it possible to say
 * how unusual a month was *for each metric on its own terms*, and how far back
 * you have to go to find a bigger move.
 * A 3% move in the ASX is a quiet fortnight; a 3% move in the cash rate would
 * be the monetary event of the decade. Ranking them together requires knowing
 * what normal looks like for each, and that requires the history.
 *
 * The page deliberately does not colour a move good or bad. For this audience
 * that is not a property of the number: a falling median is good if you are
 * buying and bad if you are holding. The reader-position angles are where that
 * framing belongs; here the job is to report what moved.
 */
import { TrendingDown, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/Skeleton";

/** "2026-05" as "May 2026". The API returns the machine form so the client can
 *  present it; showing the raw key would leak an internal format at the reader. */
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  if (Number.isNaN(d.getTime())) return month;
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** State it the way it should be said: points for rate metrics, percent for
 *  levels. Mirrors describeMove on the server so the page and any generated
 *  copy never disagree about the same figure. */
function stated(move: {
  change: number;
  changeKind: "points" | "percent";
  changePercent: number | null;
}): string {
  const sign = move.change > 0 ? "+" : "";
  if (move.changeKind === "points") {
    const dp = Math.abs(move.change) < 1 ? 2 : 1;
    return `${sign}${move.change.toFixed(dp)} pts`;
  }
  if (move.changePercent === null) return `${sign}${move.change}`;
  return `${sign}${move.changePercent.toFixed(1)}%`;
}

function Row({
  move,
}: {
  move: {
    metricKey: string;
    label: string;
    change: number;
    changeKind: "points" | "percent";
    changePercent: number | null;
    direction: "up" | "down" | "flat";
    unusualness: number | null;
    brokeStillness: boolean;
    monthsOfHistory: number;
    biggestSince: string | null;
    historyStart: string | null;
  };
}) {
  const Icon = move.direction === "up" ? TrendingUp : TrendingDown;
  return (
    <tr className="border-b border-[var(--color-border)] last:border-b-0">
      <td className="py-3 pr-4 text-[var(--color-fg)] whitespace-nowrap">{move.label}</td>
      <td className="py-3 pr-4 text-right tabular-nums whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-[var(--color-fg)]">
          <Icon className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" aria-hidden />
          {stated(move)}
        </span>
      </td>
      <td className="py-3 text-right text-[var(--color-fg-muted)] whitespace-nowrap">
        {move.brokeStillness
          ? `first move in ${move.monthsOfHistory} months`
          : move.biggestSince
            ? `biggest since ${monthLabel(move.biggestSince)}`
            : move.unusualness !== null
              ? `${move.unusualness.toFixed(1)}× its usual month`
              : "—"}
      </td>
    </tr>
  );
}

export function MonthInNumbers() {
  const { data, isLoading } = trpc.metrics.monthlyReview.useQuery(undefined, {
    staleTime: 60 * 60_000,
  });

  if (isLoading) return <Skeleton className="h-56 w-full rounded" />;
  if (!data) return null;

  const top = data.movers.slice(0, 8);

  return (
    <section className="mt-10">
      <p className="overline-amber" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
        The Month in Numbers
      </p>
      <h2 className="font-serif text-2xl font-bold leading-tight mt-2">{data.label}</h2>

      <p className="text-sm text-[var(--color-fg)] leading-relaxed mt-3 max-w-[68ch] border-l-2 border-[var(--color-accent)] pl-3">
        {data.reading}
      </p>

      {top.length > 0 && (
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-sm border-collapse min-w-[460px]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Metric", "Move", "How notable"].map((h, i) => (
                  <th
                    key={h}
                    className={`pb-2 font-mono uppercase tracking-[0.16em] text-[11px] text-[var(--color-fg-subtle)] pr-4 whitespace-nowrap ${
                      i === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top.map((m) => (
                <Row key={m.metricKey} move={m} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.unchanged.length > 0 && (
        <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed mt-4 max-w-[68ch]">
          Unchanged all month: {data.unchanged.map((m) => m.label).join(", ")}. A number holding
          still through a month is often the more useful fact.
        </p>
      )}

      {data.unranked.length > 0 && (
        <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed mt-2 max-w-[68ch]">
          {data.unranked.length} metric{data.unranked.length === 1 ? "" : "s"} moved but
          {data.unranked.length === 1 ? " has" : " have"} too little history to rank yet. They join
          the table once we hold a few complete months of them.
        </p>
      )}
    </section>
  );
}
