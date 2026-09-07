import { useEffect, useState } from "react";
import { Link } from "wouter";
import { comparisonInputSchema } from "@shared/marketComparison";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { getLoginUrl } from "@/lib/auth";
import { ComparisonRead } from "./ComparisonRead";

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
            {compare.isPending ? "Reading the evidence…" : "Compare markets"}
          </button>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Only supported dimensions. No manufactured scores.
          </p>
        </div>
      </form>
      {validation && (
        <p role="alert" className="mt-4">
          {validation}
        </p>
      )}
      {compare.isPending && (
        <p role="status" className="font-serif text-xl rule-hair-b py-8">
          Checking both market files, source dates and evidence gaps…
        </p>
      )}
      {compare.error && (
        <div role="alert" className="rule-hair-b py-5">
          <p>{compare.error.message}</p>
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
        <ComparisonRead comparison={result.comparison} shareToken={result.shareToken} />
      )}
      {result && !compare.isPending && result.anonymousRemaining != null && (
        <p className="bs-label mt-5">
          {result.anonymousRemaining} free intelligence questions remaining today
        </p>
      )}
    </section>
  );
}
