import { CityRentRead } from "./CityRentRead";
import { CityApprovalRead } from "./CityApprovalRead";
import { StatePopulationRead } from "./StatePopulationRead";
import { featuredComparison } from "./featuredComparison";
import type { MarketDirectory } from "./marketDirectory";

export function FeaturedComparisonRead({
  directory,
  onSource,
}: {
  directory: MarketDirectory;
  onSource?: () => void;
}) {
  const read = featuredComparison(directory);
  // A single retrieval contains both cities; do not combine observations fetched at different times.
  const rents = read.a?.rents;
  return (
    <article className="pb-8">
      <nav className="bs-label mb-5" aria-label="Breadcrumb">
        <a href="/markets" className="bs-link">
          Markets
        </a>{" "}
        / Brisbane vs Perth
      </nav>
      <header className="rule-major pt-5">
        <p className="bs-label-accent">Market vs market · The first read</p>
        <h1
          className="font-serif font-bold mt-3"
          style={{ fontSize: "clamp(42px, 8vw, 88px)", lineHeight: 1, letterSpacing: "-0.04em" }}
        >
          Brisbane <span className="text-[var(--color-fg-muted)]">vs</span> Perth.
        </h1>
        <h2 className="font-serif text-2xl sm:text-4xl mt-5 max-w-[32ch]">{read.headline}</h2>
        <p className="text-sm leading-6 mt-4 max-w-[75ch] text-[var(--color-fg-muted)]">
          Start with the rental read, housing approvals and state population context. Then check
          what the evidence cannot tell you about the decision. Free to read and share.
        </p>
        {directory.demo && (
          <p role="status" className="bs-label-accent mt-4">
            Demo reporting · no live rental comparison
          </p>
        )}
      </header>
      {!directory.demo && (
        <CityRentRead
          data={rents}
          marketA="Brisbane"
          marketB="Perth"
          asOf={directory.asOf}
          onSource={onSource}
        />
      )}
      <section className="rule-hair pt-5 mt-5" aria-label="The Desk read">
        <p className="bs-label-accent">The Desk read</p>
        <p className="font-serif text-2xl mt-3 max-w-[55ch]">
          {read.gap === null
            ? "The available data does not support a current rent-growth comparison."
            : "The rent-growth difference is measurable. An overall market advantage is still unproven."}
        </p>
        <p className="text-sm leading-6 mt-4 max-w-[80ch]">
          Rent inflation tells us how rents paid changed. Choosing between these markets also
          requires purchase prices, achievable yields, housing availability and demand. The
          reporting below is context; it is not a matched statistical comparison.
        </p>
        <dl className="grid sm:grid-cols-2 gap-x-8 mt-5">
          {[
            [
              "Rental conditions",
              read.gap === null
                ? "Current matching observations unavailable."
                : "Same ABS definition, unit and reference month.",
            ],
            [
              "Prices and affordability",
              "Comparable purchase-price and income measures still needed.",
            ],
            [
              "Supply and listings",
              "Check the dated approvals below. Completions, current listings and stock-adjusted comparisons are still needed.",
            ],
            [
              "Population and employment",
              "The state population context below is not a matching city boundary. Comparable local employment evidence is still needed.",
            ],
          ].map(([title, text]) => (
            <div className="rule-hair py-4" key={title}>
              <dt className="font-serif text-xl">{title}</dt>
              <dd className="text-sm leading-6 mt-2 text-[var(--color-fg-muted)]">{text}</dd>
            </div>
          ))}
        </dl>
      </section>
      {!directory.demo && (
        <CityApprovalRead
          data={read.a?.approvals}
          cities={["Brisbane", "Perth"]}
          asOf={directory.asOf}
          onSource={onSource}
        />
      )}
      {!directory.demo && (
        <StatePopulationRead
          data={read.a?.demographics}
          contexts={[
            { state: "Queensland", market: "Brisbane" },
            { state: "Western Australia", market: "Perth" },
          ]}
          asOf={directory.asOf}
        />
      )}
      <section className="rule-major mt-6 pt-5" aria-label="What would change the call">
        <h2 className="font-serif text-3xl">What would change the call?</h2>
        <p className="text-sm leading-6 mt-4 max-w-[80ch]">
          A change in the relative rent-growth rates would change the rental read. To make a wider
          call, we need evidence that rent conditions translate into sustainable yields at current
          purchase prices, alongside completions, available listings and city-matched demand and
          employment. State population context does not close those gaps. Until then, there is no
          overall winner.
        </p>
      </section>
      <section className="mt-8" aria-label="Selected housing reporting">
        <h2 className="font-serif text-3xl">The reporting behind the next question.</h2>
        <p className="bs-label mt-3">Selected housing references · Checked {directory.asOf}</p>
        <div className="grid sm:grid-cols-2 gap-8 mt-5">
          {[read.a, read.b].map((file, index) => (
            <div key={index}>
              <h3 className="font-serif text-2xl">{index === 0 ? "Brisbane" : "Perth"}</h3>
              {file?.references.length ? (
                file.references.slice(0, 3).map((ref) => (
                  <div className="rule-hair py-4 mt-3" key={ref.id}>
                    <p className="bs-label">
                      {ref.date}
                      {ref.publisher ? ` · ${ref.publisher}` : ""}
                    </p>
                    <a
                      className="bs-link block font-serif text-xl mt-2"
                      href={ref.href ?? `/story/${ref.id}`}
                      onClick={onSource}
                    >
                      {ref.title}
                    </a>
                  </div>
                ))
              ) : (
                <p className="text-sm mt-4">
                  No qualifying housing reporting in the current sample.
                </p>
              )}
              <a
                className="bs-label bs-link inline-block mt-3"
                href={`/markets/${index === 0 ? "brisbane" : "perth"}`}
              >
                Open the complete source trail →
              </a>
            </div>
          ))}
        </div>
      </section>
      <div className="rule-hair mt-8 pt-5">
        <a href="/markets?q=Brisbane&vs=Perth#comparison-form" className="bs-btn bs-btn-solid">
          Build the wider intelligence brief →
        </a>
        <p className="text-xs mt-3 text-[var(--color-fg-muted)]">
          Generating a brief uses your question allowance. The Desk will state when the evidence
          cannot support a call.
        </p>
      </div>
    </article>
  );
}
