/**
 * Public corrections log. A newsroom-grade trust signal — we publish the
 * mistakes we've made and how we fixed them. Entries are kept in this file
 * so the log itself is in version control (no CMS overhead). When a
 * correction is warranted, add an entry to the array below.
 */
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Correction = {
  /** ISO date when the correction was issued. */
  issuedOn: string;
  /** Edition or daily-feed reference the correction applies to. */
  reference: string;
  /** What was wrong, briefly. */
  what: string;
  /** What now stands corrected. */
  now: string;
};

/**
 * The log itself. Empty is a perfectly reasonable initial state — we keep
 * the page live so readers know the channel exists.
 */
const CORRECTIONS: Correction[] = [];

export default function Corrections() {
  useDocumentTitle("Corrections");
  return (
    <article className="max-w-[68ch] mx-auto py-10 space-y-6 leading-relaxed">
      <header className="space-y-2">
        <p
          className="overline-amber"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          The Desk
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
          Corrections
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Where we've fixed something publicly. Reply to any brief to flag an
          error — you'll get a same-day response.
        </p>
      </header>

      <section className="mt-8">
        {CORRECTIONS.length === 0 ? (
          <div className="panel rounded-sm p-7 text-sm text-[var(--color-fg-muted)] leading-relaxed">
            <p className="font-serif italic text-base mb-3 text-[var(--color-fg)]">
              No corrections logged yet.
            </p>
            <p>
              That's the goal, not the brag. If you spot something wrong — a
              misquoted figure, a misattributed source, a date that doesn't
              check out — email{" "}
              <a
                href="mailto:ruben@investorkit.com.au"
                className="text-amber-300 hover:text-amber-200 transition-colors"
              >
                ruben@investorkit.com.au
              </a>{" "}
              and we'll correct it on this page.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {CORRECTIONS.map((c, idx) => (
              <li
                key={`${c.issuedOn}-${idx}`}
                // Stack on mobile so the long-form correction body has the
                // full width; side-by-side from sm: where the metadata
                // column fits cleanly.
                className="panel rounded-sm p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[110px_minmax(0,1fr)] gap-3 sm:gap-5"
              >
                <div>
                  <p
                    className="overline-amber"
                    style={{ letterSpacing: "0.2em", fontSize: "9px" }}
                  >
                    Issued
                  </p>
                  <p className="font-mono text-xs tabular-nums mt-1">
                    {new Date(c.issuedOn).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p
                    className="overline-amber mt-4"
                    style={{ letterSpacing: "0.2em", fontSize: "9px" }}
                  >
                    Ref
                  </p>
                  <p className="font-mono text-xs mt-1 text-[var(--color-fg-muted)]">
                    {c.reference}
                  </p>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="overline mb-1.5">What we said</p>
                    <p className="text-[var(--color-fg-muted)] leading-relaxed">
                      {c.what}
                    </p>
                  </div>
                  <div>
                    <p className="overline mb-1.5">Now stands</p>
                    <p className="leading-relaxed">{c.now}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 pt-6 border-t border-[var(--color-border)]">
        <h2 className="font-serif text-2xl mt-2">How we handle them</h2>
        <p className="mt-3 text-[var(--color-fg-muted)]">
          Factual errors are corrected at the source — the affected story is
          updated with an "Updated" timestamp and a brief note explaining what
          changed. The fix is then logged here so the record is public, not
          just patched. Edits that don't change meaning (typos, copy polish)
          don't appear in this log.
        </p>
      </section>
    </article>
  );
}
