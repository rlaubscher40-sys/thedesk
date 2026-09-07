import { Link } from "wouter";
import { coverageLabel, marketPath } from "@shared/marketDirectory";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";

export function MarketDiscovery({ compact = false }: { compact?: boolean }) {
  const query = trpc.markets.discovery.useQuery(undefined, { staleTime: 60_000 });
  if (query.isLoading)
    return (
      <p role="status" className="bs-label py-6">
        Finding the markets in the reporting…
      </p>
    );
  if (query.isError)
    return (
      <div className="py-6">
        <p>Market discovery is temporarily unavailable.</p>
        <button
          type="button"
          className="bs-btn bs-btn-outline mt-3"
          onClick={() => void query.refetch()}
        >
          Retry market discovery
        </button>
      </div>
    );
  const markets = query.data?.markets ?? [];
  const shown = compact ? markets.filter((file) => file.referenceCount > 0).slice(0, 3) : markets;
  if (compact && !shown.length) return null;
  return (
    <section className="mt-8 rule-major pt-5" aria-label="Discover market intelligence">
      <a href="/markets/compare/brisbane-vs-perth" className="block rule-hair-b pb-5 mb-5 bs-link">
        <span className="bs-label-accent">Free comparison · Brisbane vs Perth</span>
        <span className="block font-serif text-2xl mt-2">
          What the rent evidence says—and what is still missing →
        </span>
      </a>
      <p className="bs-label-accent">Start with a place</p>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-3">
        <h2 className="font-serif text-3xl sm:text-4xl">Markets in the reporting.</h2>
        {compact && (
          <Link href="/markets" className="bs-label bs-link">
            Explore all market files →
          </Link>
        )}
      </div>
      <p className="text-sm leading-6 mt-3 text-[var(--color-fg-muted)]">
        Open the evidence first. No question, account or generated answer needed. Ordered by latest
        mention—not investment potential.
      </p>
      {query.data?.demo && (
        <p className="bs-label-accent mt-3">Demo reporting · not live market evidence</p>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-7 mt-5">
        {shown.map((file) => (
          <Link
            key={file.market.slug}
            href={marketPath(file.market.slug)}
            className="block min-w-0 rule-hair py-5 bs-row"
            onClick={() => trackEvent("market_discover", compact ? "today" : "markets")}
          >
            <p className="bs-label">
              {file.market.state} · {coverageLabel(file)}
            </p>
            <h3 className="font-serif text-3xl mt-2">
              {file.market.name} <span aria-hidden="true">↗</span>
            </h3>
            <p className="text-sm leading-6 mt-3">
              {file.references[0]?.title ??
                "The evidence gap is visible. Explore the file or ask a broader question."}
            </p>
            <p className="bs-label mt-4">
              {file.referenceCount} selected references
              {file.latestMention ? ` · ${file.latestMention}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
