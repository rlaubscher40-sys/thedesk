/**
 * Public corrections log. A newsroom-grade trust signal, we publish the
 * mistakes we've made and how we fixed them. Entries are kept in this file
 * so the log itself is in version control (no CMS overhead). When a
 * correction is warranted, add an entry to the array below.
 */
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { EDITORIAL_CONTACT } from "../../../shared/legal";

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
 * The log itself. Empty is a perfectly reasonable initial state, we keep
 * the page live so readers know the channel exists.
 */
const CORRECTIONS: Correction[] = [];

export default function Corrections() {
  useDocumentTitle("Corrections");
  return (
    <article className="max-w-[68ch] mx-auto py-10 space-y-6 leading-relaxed">
      <header className="space-y-2">
        <p className="overline-amber" style={{ letterSpacing: "0.22em", fontSize: "0.75rem" }}>
          The Desk
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">Corrections</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Report an error, copyright concern or privacy issue using the contact details below.
        </p>
      </header>
      <div className="editorial-rule-soft" aria-hidden="true" />

      <section className="panel rounded-sm p-6 space-y-3 text-sm">
        <h2 className="font-serif text-2xl">Report a concern</h2>
        <p>
          Email{" "}
          <a className="bs-link" href={`mailto:${EDITORIAL_CONTACT}`}>
            {EDITORIAL_CONTACT}
          </a>{" "}
          with the story or post URL, what concerns you, supporting information and how we can
          contact you.
        </p>
        <p>
          For a copyright concern, identify the work, your connection to the rights holder and the
          material in question. For a privacy request, describe the information or account involved.
          Please do not send passwords, identity documents or other sensitive information in your
          initial message.
        </p>
        <p>
          Mark urgent matters clearly, especially a court restriction, safety concern or exposed
          personal information. We may request further information to assess the concern or verify a
          request.
        </p>
      </section>

      <section className="mt-8">
        {CORRECTIONS.length === 0 ? (
          <div className="panel rounded-sm p-7 text-sm text-[var(--color-fg-muted)] leading-relaxed">
            <p className="font-serif italic text-base mb-3 text-[var(--color-fg)]">
              No corrections logged yet.
            </p>
            <p>
              That's the goal, not the brag. If you spot something wrong, a misquoted figure, a
              misattributed source, a date that doesn't check out, email{" "}
              <a
                href="mailto:ruben@thedesk.au"
                className="text-amber-300 hover:text-amber-200 transition-colors"
              >
                ruben@thedesk.au
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
                    style={{ letterSpacing: "0.2em", fontSize: "0.75rem" }}
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
                    style={{ letterSpacing: "0.2em", fontSize: "0.75rem" }}
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
                    <p className="text-[var(--color-fg-muted)] leading-relaxed">{c.what}</p>
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
          Factual errors are corrected at the source, the affected story is updated with an
          "Updated" timestamp and a brief note explaining what changed. The fix is then logged here
          so the record is public, not just patched. Edits that don't change meaning (typos, copy
          polish) don't appear in this log.
        </p>
      </section>
    </article>
  );
}
