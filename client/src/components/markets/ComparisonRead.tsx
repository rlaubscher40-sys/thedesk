import { Link } from "wouter";
import { MARKET_DIMENSIONS, type MarketComparison } from "@shared/marketComparison";
import { ShareIntelligenceCardButton } from "@/components/ask/ShareIntelligenceCardButton";

/** The same evidence object appears in Markets and its signed public destination. */
export function ComparisonRead({
  comparison: c,
  shareToken,
  shared = false,
}: {
  comparison: MarketComparison;
  shareToken: string;
  shared?: boolean;
}) {
  const supported = new Set(c.rows.map((row) => row.dimension));
  const gaps = Object.entries(MARKET_DIMENSIONS).filter(
    ([key]) => !supported.has(key as keyof typeof MARKET_DIMENSIONS)
  );
  const challenge = `What evidence would challenge this comparison of ${c.marketA} vs ${c.marketB}?`;
  return (
    <article className="rule-major mt-8 pt-6" aria-label="Market comparison">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="bs-label-accent">The Desk Read · {c.asOf}</p>
        <ShareIntelligenceCardButton
          shareToken={shareToken}
          headline={`${c.marketA} vs ${c.marketB}`}
          comparison
        />
      </div>
      <h2
        className="font-serif font-bold mt-5 break-words"
        style={{ fontSize: "clamp(38px, 6vw, 76px)", lineHeight: 0.98, letterSpacing: "-0.035em" }}
      >
        {c.marketA} <span className="text-[var(--color-accent-text)]">vs</span> {c.marketB}
      </h2>
      <p className="font-serif text-2xl sm:text-3xl leading-tight mt-5 max-w-[55ch]">{c.verdict}</p>
      <p className="bs-label mt-5">
        {c.confidence} evidence confidence · {c.sources.length} Desk sources
      </p>
      <p className="text-sm leading-6 text-[var(--color-fg-muted)] mt-2 max-w-[80ch]">
        Confidence reflects the available evidence, not future returns. Desk coverage is not an
        independent audit; a missing observation does not make a market weaker. Dates below identify
        the source publication.
      </p>

      <section className="mt-8 rule-hair-b" aria-label="Evidence by dimension">
        <p className="bs-label-accent rule-hair py-4">The forces behind the call</p>
        {c.rows.map((row) => (
          <section key={row.dimension} className="rule-hair py-5">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-serif text-2xl">{MARKET_DIMENSIONS[row.dimension]}</h3>
              <p className="bs-label-accent">
                {row.edge === "unclear"
                  ? "No clear edge"
                  : `Evidence leans ${row.edge === "a" ? c.marketA : c.marketB}`}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              {(["a", "b"] as const).map((side) => {
                const observation = side === "a" ? row.marketA : row.marketB;
                const source = c.sources.find((item) => item.ref === observation?.sourceRef);
                return (
                  <div key={side} className={side === "b" ? "md:rule-hair-l md:pl-6" : ""}>
                    <p className="bs-label">{side === "a" ? c.marketA : c.marketB}</p>
                    {observation && source ? (
                      <>
                        <blockquote className="font-serif text-lg leading-7 mt-2">
                          “{observation.quote}”
                        </blockquote>
                        <a
                          href={`#comparison-source-${source.ref}`}
                          className="bs-label bs-link mt-3 inline-block"
                        >
                          [{source.ref}] {source.publisher ?? "Desk reporting"} · {source.date}
                        </a>
                      </>
                    ) : (
                      <p className="text-sm text-[var(--color-fg-muted)] mt-2">
                        No supported local observation in this evidence set.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[var(--color-fg-body)] mt-5 max-w-[90ch]">
              <span className="bs-label-accent mr-2">Desk interpretation</span>
              {row.read}
            </p>
          </section>
        ))}
      </section>

      <div className="grid md:grid-cols-2 gap-6 rule-hair-b py-6">
        {(["a", "b"] as const).map((side) => {
          const wins = c.rows.filter((row) => row.edge === side);
          return (
            <section key={side}>
              <h3 className="bs-label-accent">
                Where {side === "a" ? c.marketA : c.marketB} has an edge
              </h3>
              <p className="font-serif text-xl leading-7 mt-3">
                {wins.length
                  ? wins.map((row) => MARKET_DIMENSIONS[row.dimension]).join(" · ")
                  : "No clear advantage established by this evidence."}
              </p>
            </section>
          );
        })}
      </div>
      <div className="grid md:grid-cols-2 gap-6 py-6">
        <section>
          <h3 className="bs-label-accent">The Desk Take</h3>
          <p className="font-serif text-xl leading-8 mt-3">{c.deskTake}</p>
        </section>
        <section>
          <h3 className="bs-label-accent">What would change the call</h3>
          <p className="font-serif text-xl leading-8 mt-3">{c.whatWouldChangeTheCall}</p>
        </section>
      </div>
      {gaps.length > 0 && (
        <section className="rule-hair py-5">
          <h3 className="bs-label">Evidence gaps</h3>
          <p className="text-sm leading-6 text-[var(--color-fg-muted)] mt-2">
            No supported comparison for: {gaps.map(([, label]) => label).join(" · ")}. National
            conditions alone do not establish a local advantage.
          </p>
        </section>
      )}
      <section className="rule-hair rule-hair-b py-5">
        <h3 className="bs-label-accent">Source trail</h3>
        {c.sources.map((source) => (
          <div
            key={source.ref}
            id={`comparison-source-${source.ref}`}
            className="rule-hair py-3 mt-3 scroll-mt-24"
          >
            <Link href={source.href} className="font-serif text-lg bs-link">
              [{source.ref}] {source.title}
            </Link>
            <p className="bs-label mt-2">
              {source.publisher ?? "Desk reporting"} · {source.date} ·{" "}
              {source.markets.map((side) => (side === "a" ? c.marketA : c.marketB)).join(" / ")}
            </p>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap gap-3 mt-6">
        <Link href={`/ask?q=${encodeURIComponent(challenge)}`} className="bs-btn bs-btn-solid">
          Challenge the call
        </Link>
        {shared ? (
          <Link
            href={`/markets?q=${encodeURIComponent(c.marketA)}&vs=${encodeURIComponent(c.marketB)}`}
            className="bs-btn bs-btn-outline"
          >
            Compare with fresh evidence
          </Link>
        ) : (
          <a href="#comparison-form" className="bs-btn bs-btn-outline">
            Edit comparison
          </a>
        )}
        <Link
          href={`/markets?q=${encodeURIComponent(c.marketA)}`}
          className="bs-btn bs-btn-outline"
        >
          Open {c.marketA}
        </Link>
        <Link
          href={`/markets?q=${encodeURIComponent(c.marketB)}`}
          className="bs-btn bs-btn-outline"
        >
          Open {c.marketB}
        </Link>
      </div>
    </article>
  );
}
