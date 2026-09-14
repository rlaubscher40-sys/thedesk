/**
 * Editorial standards. Trust-builder for a content-heavy product.
 * Covers: who curates, sourcing policy, AI use disclosure, conflicts,
 * corrections.
 */
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function EditorialStandards() {
  useDocumentTitle("Editorial standards");
  return (
    <article className="max-w-[68ch] mx-auto py-10 space-y-6 leading-relaxed">
      <header className="space-y-2">
        <p className="overline-amber" style={{ letterSpacing: "0.22em", fontSize: "0.75rem" }}>
          The Desk
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
          Editorial standards
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          How reporting is selected, interpreted and corrected at The Desk.
        </p>
      </header>
      <div className="editorial-rule-soft" aria-hidden="true" />

      <section className="space-y-4">
        <h2 className="font-serif text-2xl mt-8">Who curates</h2>
        <p>
          Ruben Laubscher sets the editorial direction. Automated collection, relevance rules and
          AI-assisted synthesis produce daily and weekly briefings. Human oversight and corrections
          guide the service, but each automated output is not individually pre-approved.
        </p>

        <h2 className="font-serif text-2xl mt-8">Sourcing</h2>
        <p>
          We summarise from primary sources where possible: the RBA, APRA, ASIC, ABS, Treasury, and
          major mastheads. Story pages link to the original reporting when a source URL is available
          so you can verify and read further. Social-pulse items (Reddit, X) are sourced for
          sentiment context, not as primary evidence. We do not republish whole articles.
        </p>

        <h2 className="font-serif text-2xl mt-8">Use of AI</h2>
        <p>
          AI assists with summaries, story selection, reader angles and weekly analysis. Ask and
          market briefs generate interpretations from retrieved reporting. These can contain errors
          or incomplete evidence. They show supporting sources and uncertainty; an evidence link is
          an invitation to verify the claim, not a guarantee that the interpretation is correct.
        </p>

        <h2 className="font-serif text-2xl mt-8">Conflicts of interest</h2>
        <p>
          Ruben may comment on markets, lenders, agencies or research firms with whom he has a
          commercial relationship. Paid placements and material commercial connections should be disclosed alongside the
          affected content. Report a missing disclosure through our Corrections page.
        </p>

        <h2 className="font-serif text-2xl mt-8">Corrections</h2>
        <p>
          We correct factual errors openly and quickly. Use the Corrections page or reply to a
          briefing to flag an error. Include the story link and the evidence that needs review.
        </p>

        <h2 className="font-serif text-2xl mt-8">Not financial advice</h2>
        <p>
          The Desk publishes general information and editorial commentary. Nothing here is personal
          financial, tax, legal or property advice. Always check your circumstances with a qualified
          professional before acting.
        </p>
      </section>
    </article>
  );
}
