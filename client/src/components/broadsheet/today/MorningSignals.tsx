import { ArrowRight, MoveDownRight, MoveUpRight, Radio } from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { trpc } from "@/lib/trpc";
import { GUTTER_X } from "../tokens";

function pctMove(first: number, last: number): number {
  if (Math.abs(first) < 0.000001) return last - first;
  return ((last - first) / Math.abs(first)) * 100;
}

function displayValue(metric: { value: string; unit?: string | null }): string {
  const unit = metric.unit?.trim();
  if (!unit) return metric.value;
  if (unit === "%" && metric.value.includes("%")) return metric.value;
  if (unit === "$" && metric.value.startsWith("$")) return metric.value;
  if (unit === "%") return `${metric.value}%`;
  if (unit === "$") return `$${metric.value}`;
  return `${metric.value} ${unit}`;
}

function moveLabel(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "No 30d move";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}% · 30d`;
}

/**
 * The three biggest live moves, deliberately separate from the full metric
 * dashboard lower on Today. This is the 5-second answer to "what changed?"
 * before a reader commits to the morning edition.
 */
export function MorningSignals() {
  const metrics = trpc.metrics.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const histories = trpc.metrics.histories.useQuery(undefined, { staleTime: 30 * 60_000 });

  const movers = useMemo(() => {
    return (metrics.data ?? [])
      .map((metric) => {
        const series = histories.data?.[metric.metricKey] ?? [];
        const first = series[0]?.value;
        const last = series[series.length - 1]?.value;
        const move =
          typeof first === "number" && typeof last === "number" && series.length >= 2
            ? pctMove(first, last)
            : null;
        return { metric, move };
      })
      .sort((a, b) => Math.abs(b.move ?? -1) - Math.abs(a.move ?? -1))
      .slice(0, 3);
  }, [metrics.data, histories.data]);

  if (metrics.isLoading || histories.isLoading) {
    return (
      <section className={`${GUTTER_X} mt-7`} aria-label="Morning signals" aria-busy="true">
        <div className="rule-major grid sm:grid-cols-3">
          <Skeleton className="h-28 rounded-none" />
          <Skeleton className="h-28 rounded-none" />
          <Skeleton className="h-28 rounded-none" />
        </div>
      </section>
    );
  }

  if (movers.length === 0) return null;

  return (
    <section className={`${GUTTER_X} mt-7`} aria-label="Morning signals">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-2.5">
          <Radio className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />
          <p className="bs-label-accent">Moving now</p>
        </div>
        <Link href="/signals" className="bs-label bs-link inline-flex items-center gap-1.5">
          Open signals <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="rule-major rule-hair-b grid sm:grid-cols-3">
        {movers.map(({ metric, move }, index) => {
          const rising = (move ?? 0) >= 0;
          const MoveIcon = rising ? MoveUpRight : MoveDownRight;
          return (
            <Link
              key={metric.metricKey}
              href="/signals"
              className={`${index > 0 ? "sm:rule-hair-l sm:pl-6" : ""} ${index < movers.length - 1 ? "sm:pr-6" : ""} py-5 bs-row block min-w-0`}
            >
              <p className="bs-label truncate">{metric.label}</p>
              <p
                className="font-serif font-bold tabular-nums mt-2"
                style={{ fontSize: "clamp(34px, 4.5vw, 52px)", lineHeight: 0.95, letterSpacing: "-0.035em" }}
              >
                {displayValue(metric)}
              </p>
              <div className="flex items-center gap-1.5 mt-2 font-mono text-[10px] text-[var(--color-accent-text)]">
                {move != null && <MoveIcon className="h-3 w-3" />}
                {moveLabel(move)}
              </div>
              {metric.context && (
                <p className="mt-2 text-xs leading-5 text-[var(--color-fg-muted)] line-clamp-2">
                  {metric.context}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
