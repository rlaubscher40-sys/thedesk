import { regionalContext } from "./regionalContext";

export function RegionalContextRead({ market, asOf }: { market: string; asOf: string }) {
  const entries = regionalContext(market, asOf);
  if (!entries.length) return null;
  return (
    <section
      id="primary-context"
      aria-label="Reviewed primary-source context"
      className="rule-hair mt-6 py-6"
    >
      <p className="bs-label-accent">Primary sources · Reviewed context</p>
      <h2 className="font-serif text-3xl mt-3">Beyond the news sample.</h2>
      <p className="text-sm leading-6 mt-3 max-w-[80ch] text-[var(--color-fg-muted)]">
        Dated statements from the organisations involved. These are separate from the
        selected-reporting count and are not independent confirmation, live project status or a
        market forecast.
      </p>
      {entries.map((entry) => (
        <article key={entry.sourceUrl} className="rule-hair mt-5 pt-5">
          <p className="bs-label">
            {entry.publisher} · Published {entry.publishedOn}
          </p>
          <h3 className="font-serif text-xl sm:text-2xl mt-2">{entry.title}</h3>
          <p className="text-base leading-7 mt-3 max-w-[75ch]">{entry.summary}</p>
          <p className="text-sm leading-6 mt-3 max-w-[85ch] text-[var(--color-fg-muted)]">
            {entry.limitation}
          </p>
          <p className="text-sm leading-6 mt-2">
            Source checked with AI assistance {entry.reviewedOn}; not human verification.
            {entry.reviewDue
              ? " Review due: this is an older checked record, not verified current status."
              : ""}
          </p>
          <a
            className="bs-link bs-period-link text-sm mt-3"
            href={entry.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the original statement ↗
          </a>
        </article>
      ))}
    </section>
  );
}
