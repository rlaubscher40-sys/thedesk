import React from "react";
import {
  coverageLabel,
  marketPath,
  marketQuestion,
  type MarketDirectory,
  type PublicMarketFile,
} from "./marketDirectory";

/** Shared visible content: crawlers and readers get the same source-backed page. */
export function PublicMarketRead({
  file,
  directory,
  onAction,
}: {
  file: PublicMarketFile;
  directory: MarketDirectory;
  onAction?: (action: "ask" | "compare" | "source") => void;
}) {
  const { market } = file;
  const lead = file.references[0];
  const peers = directory.markets
    .filter((item) => item.market.slug !== market.slug && item.coverage === "recent")
    .slice(0, 3);
  return (
    <article className="min-w-0 pb-10">
      <nav aria-label="Breadcrumb" className="bs-label mb-5">
        <a href="/" className="bs-link">
          The Desk
        </a>{" "}
        /{" "}
        <a href="/markets" className="bs-link">
          Markets
        </a>{" "}
        / {market.name}
      </nav>
      <header className="rule-major pt-5">
        <p className="bs-label-accent">The market file · {market.state}</p>
        <h1
          className="font-serif font-bold mt-3 break-words"
          style={{
            fontSize: "clamp(52px, 10vw, 112px)",
            lineHeight: 0.96,
            letterSpacing: "-0.045em",
          }}
        >
          {market.name}.
        </h1>
        <p className="font-serif text-xl sm:text-2xl mt-4 max-w-[48ch] text-[var(--color-fg-muted)]">
          What is in the evidence. What is still missing. Where to look next.
        </p>
        {directory.demo && (
          <p role="status" className="bs-label-accent mt-4">
            Demo reporting · not live market evidence
          </p>
        )}
        <p className="bs-label mt-5">
          {coverageLabel(file)} · Checked {file.asOf}
        </p>
      </header>

      <section className="rule-hair rule-hair-b mt-6 py-6" aria-label="Latest reporting">
        <p className="bs-label-accent">
          {lead ? `Latest selected report · ${lead.date}` : "An open evidence gap"}
        </p>
        <h2 className="font-serif font-bold text-3xl sm:text-4xl leading-tight mt-3 max-w-[34ch]">
          {lead ? (
            <a href={`/story/${lead.id}`} onClick={() => onAction?.("source")} className="bs-link">
              {lead.title}
            </a>
          ) : (
            `No recent reporting selected for ${market.name}.`
          )}
        </h2>
        {lead && (
          <p className="text-base leading-7 mt-4 max-w-[70ch] text-[var(--color-fg-muted)]">
            {lead.excerpt}
          </p>
        )}
        <p className="text-sm mt-4 text-[var(--color-fg-muted)]">
          {lead?.publisher ? `${lead.publisher} · ` : ""}A reporting reference, not a valuation or a
          recommendation to buy.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <a
            href={`/ask?q=${encodeURIComponent(marketQuestion(market.name))}`}
            onClick={() => onAction?.("ask")}
            className="bs-btn bs-btn-solid"
          >
            Ask what it means for {market.name}
          </a>
          <a
            href={`/markets?q=${encodeURIComponent(market.name)}&vs=`}
            onClick={() => onAction?.("compare")}
            className="bs-btn bs-btn-outline"
          >
            Compare another market
          </a>
        </div>
        <p className="text-xs mt-3 text-[var(--color-fg-muted)]">
          Reading this file is free. Questions and comparisons use your intelligence allowance.
        </p>
      </section>

      <div className="grid sm:grid-cols-3 gap-5 py-6 rule-hair-b">
        <div>
          <p className="bs-label">Selected references · 90 days</p>
          <p className="font-mono text-4xl mt-2">{file.referenceCount}</p>
        </div>
        <div>
          <p className="bs-label">Distinct source websites</p>
          <p className="font-mono text-4xl mt-2">{file.publisherCount}</p>
        </div>
        <div>
          <p className="bs-label">Latest mention</p>
          <p className="font-mono text-xl mt-3">{file.latestMention ?? "None in sample"}</p>
        </div>
      </div>
      <p className="text-sm leading-6 mt-4 max-w-[80ch] text-[var(--color-fg-muted)]">
        Coverage is not confidence in a market. Counts describe deduplicated reporting, not
        independent datasets, price momentum or investment quality. A mention does not establish a
        consistent city boundary or property type.
      </p>

      <section className="mt-9" aria-label="Market source trail">
        <h2 className="font-serif text-3xl">The source trail</h2>
        <p className="bs-label mt-3">
          {file.since} to {file.asOf} · Newest first · Up to 12 references shown
        </p>
        {file.references.map((reference) => (
          <div key={reference.id} className="rule-hair py-5 mt-3">
            <p className="bs-label">
              {reference.date} · {reference.category}
              {reference.publisher ? ` · ${reference.publisher}` : ""}
            </p>
            <h3 className="font-serif text-xl sm:text-2xl mt-2">
              <a
                href={`/story/${reference.id}`}
                className="bs-link"
                onClick={() => onAction?.("source")}
              >
                {reference.title}
              </a>
            </h3>
            <p className="text-sm leading-6 mt-2 max-w-[80ch] text-[var(--color-fg-muted)]">
              {reference.excerpt}
            </p>
            {reference.sourceUrl && (
              <a
                href={reference.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
                className="bs-label bs-link inline-block mt-3"
                onClick={() => onAction?.("source")}
              >
                Original reporting ↗
              </a>
            )}
          </div>
        ))}
        {!lead && (
          <p className="mt-4 text-[var(--color-fg-muted)]">
            Missing coverage is not a negative market signal. Explore the broader archive or ask a
            question; The Desk will state when it cannot support an answer.
          </p>
        )}
      </section>

      {peers.length > 0 && (
        <section className="rule-major mt-9 pt-5">
          <p className="bs-label-accent">Put the evidence to the test</p>
          <h2 className="font-serif text-3xl mt-3">{market.name} versus…</h2>
          <p className="text-sm mt-3 text-[var(--color-fg-muted)]">
            Other markets with recent reporting. These are starting points, not ranked
            opportunities. A comparison may still lack matching evidence.
          </p>
          <div className="grid sm:grid-cols-3 gap-5 mt-5">
            {peers.map((peer) => (
              <div key={peer.market.slug} className="rule-hair pt-4">
                <a
                  className="font-serif text-2xl bs-link"
                  href={`/markets?q=${encodeURIComponent(market.name)}&vs=${encodeURIComponent(peer.market.name)}`}
                  onClick={() => onAction?.("compare")}
                >
                  {market.name} vs {peer.market.name} →
                </a>
                <a className="bs-label bs-link block mt-3" href={marketPath(peer.market.slug)}>
                  Read {peer.market.name}'s file
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
      <details className="rule-hair mt-8 pt-4 text-sm text-[var(--color-fg-muted)]">
        <summary className="cursor-pointer">How this file is assembled</summary>
        <p className="mt-3 leading-6">
          Exact city-name mentions in the title or summary of Australian and property-lane
          reporting, across property, macro, markets, policy and economics. The sample covers up to{" "}
          {directory.sampleLimit} recent records over 90 days
          {directory.sampleCapped ? " and currently reaches that limit" : ""}. Weekly editions and
          licensed local datasets are not counted here. Duplicate source URLs and identical
          headlines are collapsed. Source website counts do not prove independence. “Recent”
          requires at least three references, two source websites and a mention in the last 30 days.
          This is a coverage threshold, not a market score.
        </p>
      </details>
    </article>
  );
}
