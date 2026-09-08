import { AUCTION_REGIONS, AUCTION_SOURCE } from "@shared/auctionClearance";
import type { DailyMetric } from "@shared/types";

export function AuctionClearance({
  metrics,
  loading,
}: {
  metrics: DailyMetric[] | undefined;
  loading: boolean;
}) {
  const regions = ["Australia", ...AUCTION_REGIONS];
  return (
    <section className="rule-major mt-8 py-6" aria-busy={loading}>
      <p className="bs-label-accent">Auction results</p>
      <h2 className="bs-headline mt-3 text-2xl">Clearance across Australia</h2>
      <p className="mt-3 max-w-3xl text-sm text-[var(--color-fg-muted)]">
        Australia is the weighted average: total sold divided by total reported
        outcomes across all eight states and territories for the same week.
        Preliminary results include sales before, at and after auction, with
        withdrawn and passed-in properties in the denominator.
      </p>
      {loading ? (
        <p className="mt-4" role="status">
          Loading auction results…
        </p>
      ) : (
        <div className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((region) => {
            const key =
              region === "Australia"
                ? "auction_clearance"
                : `${region.toLowerCase()}_auction_clearance`;
            const row = metrics?.find(
              (metric) =>
                metric.metricKey === key && metric.source === AUCTION_SOURCE,
            );
            const date = row ? new Date(row.asOf) : null;
            const stale =
              date &&
              (Date.now() - date.getTime() > 14 * 86_400_000 ||
                date.getTime() > Date.now());
            const counts = row?.context?.match(
              /(\d+) sold \/ (\d+) reported; (\d+) scheduled/,
            );
            return (
              <article
                key={region}
                className="border-b border-[var(--color-border)] py-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold">{region}</h3>
                  <p className="text-xl tabular-nums">
                    {row ? `${row.value}${row.unit ?? ""}` : "Unavailable"}
                  </p>
                </div>
                {date && (
                  <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                    Week ending{" "}
                    {date.toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                    {stale ? " · needs update" : " · preliminary"}
                  </p>
                )}
                {counts && (
                  <p className="mt-1 text-sm">
                    {counts[1]} sold / {counts[2]} reported · {counts[3]}{" "}
                    scheduled{Number(counts[2]) < 10 ? " · small sample" : ""}
                  </p>
                )}
                {!row && (
                  <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                    {region === "Australia"
                      ? "Waiting for matching weekly counts from all eight jurisdictions."
                      : "No verified statewide results collected yet."}
                  </p>
                )}
                {row?.sourceUrl && (
                  <a
                    className="mt-2 inline-block text-sm underline underline-offset-4"
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View source
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
