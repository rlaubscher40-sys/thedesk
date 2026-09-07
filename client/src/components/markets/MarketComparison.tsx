import { useEffect, useState } from "react";
import { Link } from "wouter";
import { comparisonInputSchema } from "@shared/marketComparison";
import { comparisonPairKey } from "@shared/comparisonChanges";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { getLoginUrl } from "@/lib/auth";
import { ComparisonRead } from "./ComparisonRead";
import { MarketRentConditions } from "./MarketRentConditions";
import { ComparisonChangeSummary } from "./ComparisonChangeSummary";
import { useComparisonWatches } from "@/lib/useComparisonWatches";

export function MarketComparison({
  marketA,
  marketB,
  onCompare,
}: {
  marketA: string;
  marketB: string;
  onCompare: (a: string, b: string) => void;
}) {
  const [a, setA] = useState(marketA);
  const [b, setB] = useState(marketB);
  const [validation, setValidation] = useState("");
  const compare = trpc.markets.compare.useMutation();
  const { watches } = useComparisonWatches();
  const watch = watches.find(
    (item) => comparisonPairKey(item.marketA, item.marketB) === comparisonPairKey(marketA, marketB)
  );
  const baseline = trpc.ask.shared.useQuery(
    { token: watch?.baselineToken ?? "" },
    { enabled: Boolean(watch), retry: false, staleTime: 60_000 }
  );
  const verifiedBaseline =
    !baseline.isError &&
    baseline.data?.comparison &&
    comparisonPairKey(baseline.data.comparison.marketA, baseline.data.comparison.marketB) ===
      comparisonPairKey(marketA, marketB)
      ? baseline.data.comparison
      : null;
  useEffect(() => {
    setA(marketA);
    setB(marketB);
    if (
      compare.variables &&
      (compare.variables.marketA !== marketA || compare.variables.marketB !== marketB)
    )
      compare.reset();
  }, [marketA, marketB]);
  function submit() {
    if (compare.isPending) return;
    const parsed = comparisonInputSchema.safeParse({ marketA: a, marketB: b });
    if (!parsed.success) {
      setValidation(parsed.error.issues[0]?.message ?? "Choose two markets.");
      return;
    }
    setValidation("");
    onCompare(parsed.data.marketA, parsed.data.marketB);
    trackEvent("market_compare", "markets");
    if (
      watches.some(
        (item) =>
          comparisonPairKey(item.marketA, item.marketB) ===
          comparisonPairKey(parsed.data.marketA, parsed.data.marketB)
      )
    )
      trackEvent("comparison_refresh", "markets");
    compare.mutate(parsed.data);
  }
  // Result identity, not editable inputs, determines what can be shown or shared.
  const result = compare.data;
  return (
    <section className="mt-8">
      <h2 className="bs-label-accent">Market vs market</h2>
      <p className="font-serif text-2xl mt-3">
        Where is the setup stronger, and what could change the call?
      </p>
      <form
        id="comparison-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-end rule-hair rule-hair-b py-5 mt-5"
      >
        <label className="min-w-0">
          <span className="bs-label">Market A</span>
          <input
            aria-label="Market A"
            value={a}
            onChange={(e) => setA(e.target.value)}
            maxLength={64}
            required
            disabled={compare.isPending}
            placeholder="Brisbane"
            className="w-full bg-transparent border-b border-[var(--color-border)] py-3 font-serif text-3xl focus:outline-[var(--color-accent-text)]"
          />
        </label>
        <span className="bs-label-accent pb-4">vs</span>
        <label className="min-w-0">
          <span className="bs-label">Market B</span>
          <input
            aria-label="Market B"
            value={b}
            onChange={(e) => setB(e.target.value)}
            maxLength={64}
            required
            disabled={compare.isPending}
            placeholder="Perth"
            className="w-full bg-transparent border-b border-[var(--color-border)] py-3 font-serif text-3xl focus:outline-[var(--color-accent-text)]"
          />
        </label>
        <div className="sm:col-span-3 flex flex-wrap gap-4 items-center">
          <button
            type="submit"
            disabled={compare.isPending}
            className="bs-btn bs-btn-solid disabled:opacity-50"
          >
            {compare.isPending
              ? "Reading the evidence…"
              : watch
                ? "Refresh comparison"
                : "Compare markets"}
          </button>
          <p className="text-sm text-[var(--color-fg-muted)]">
            {watch
              ? "Refresh uses the same intelligence allowance as a new question."
              : "Only supported dimensions. No manufactured scores."}
          </p>
        </div>
      </form>
      {validation && (
        <p role="alert" className="mt-4">
          {validation}
        </p>
      )}
      <MarketRentConditions marketA={marketA} marketB={marketB} />
      {watch && baseline.isLoading && (
        <p role="status" className="mt-4">
          Verifying your saved baseline…
        </p>
      )}
      {watch && baseline.isError && (
        <div role="status" className="rule-hair py-4 mt-4">
          <p>
            {baseline.error.data?.code === "NOT_FOUND"
              ? "Your saved baseline has expired or is no longer valid. Refresh to build a new read; the old baseline will not be used to claim changes."
              : "Your saved baseline could not be verified right now. A refresh will not claim changes until the baseline is available."}
          </p>
          {baseline.error.data?.code !== "NOT_FOUND" && (
            <button
              type="button"
              onClick={() => void baseline.refetch()}
              className="bs-btn bs-btn-outline mt-3"
            >
              Retry saved baseline
            </button>
          )}
        </div>
      )}
      {watch && baseline.data && !baseline.isError && !verifiedBaseline && (
        <p role="alert" className="mt-4">
          The saved brief does not match this market pair. Refresh to create a verified comparison.
        </p>
      )}
      {watch && verifiedBaseline && !compare.isPending && !compare.data && !compare.error && (
        <>
          <p className="bs-label mt-7">Saved baseline · not a live market update</p>
          <ComparisonRead comparison={verifiedBaseline} shareToken={watch.baselineToken} />
        </>
      )}
      {compare.isPending && (
        <p role="status" className="font-serif text-xl rule-hair-b py-8">
          Checking both market files, source dates and evidence gaps…
        </p>
      )}
      {compare.error && (
        <div role="alert" className="rule-hair-b py-5">
          <p>{compare.error.message}</p>
          {verifiedBaseline && (
            <button
              type="button"
              onClick={() => compare.reset()}
              className="bs-btn bs-btn-outline mt-3"
            >
              View saved baseline
            </button>
          )}
          {compare.error.data?.code === "TOO_MANY_REQUESTS" && (
            <a href={getLoginUrl()} className="bs-btn bs-btn-outline mt-3">
              Sign in
            </a>
          )}
        </div>
      )}
      {!compare.isPending && !compare.error && result?.status === "insufficient" && (
        <section className="rule-major mt-8 pt-6" role="status">
          <h3 className="font-serif text-3xl">Not enough evidence to make the call.</h3>
          <p className="mt-3 text-[var(--color-fg-muted)]">{result.message}</p>
          {verifiedBaseline && (
            <button
              type="button"
              onClick={() => compare.reset()}
              className="bs-btn bs-btn-outline mt-3"
            >
              View saved baseline
            </button>
          )}
          <p className="bs-label mt-4">
            Retrieved local records · {compare.variables?.marketA}: {result.coverage.a} ·{" "}
            {compare.variables?.marketB}: {result.coverage.b}
          </p>
          {result.sources.map((source) => (
            <Link
              key={source.ref}
              href={source.href}
              className="bs-link block font-serif text-lg mt-3"
            >
              {source.title} · {source.date}
            </Link>
          ))}
        </section>
      )}
      {!compare.isPending && !compare.error && result?.status === "compared" && (
        <>
          {verifiedBaseline && watch?.baselineToken !== result.shareToken && (
            <>
              <ComparisonChangeSummary baseline={verifiedBaseline} current={result.comparison} />
              {watch && (
                <Link
                  href={`/brief?t=${encodeURIComponent(watch.baselineToken)}`}
                  className="bs-btn bs-btn-outline mt-3"
                >
                  Open the saved source trail
                </Link>
              )}
            </>
          )}
          <ComparisonRead comparison={result.comparison} shareToken={result.shareToken} />
        </>
      )}
      {result && !compare.isPending && result.anonymousRemaining != null && (
        <p className="bs-label mt-5">
          {result.anonymousRemaining} free intelligence questions remaining today
        </p>
      )}
    </section>
  );
}
