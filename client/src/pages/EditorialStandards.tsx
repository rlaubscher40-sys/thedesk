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
        <p
          className="overline-amber"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          The Desk
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">
          Editorial standards
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          The Desk is a curated product, not an aggregator. This page is how
          you can hold us to that.
        </p>
      </header>
      <div className="editorial-rule-soft" aria-hidden="true" />

      <section className="space-y-4">
        <h2 className="font-serif text-2xl mt-8">Who curates</h2>
        <p>
          Every edition is hand-curated by Ruben Laubscher. The angle on each
          story reflects an editorial judgement about what the partner channel
          needs to know that morning.
        </p>

        <h2 className="font-serif text-2xl mt-8">Sourcing</h2>
        <p>
          We summarise from primary sources where possible: the RBA, APRA,
          ASIC, ABS, Treasury, and major mastheads. We link to the original
          article from every card so you can verify and read further.
          Social-pulse items (Reddit, X) are sourced for sentiment context,
          not as primary evidence. We do not republish whole articles.
        </p>

        <h2 className="font-serif text-2xl mt-8">Use of AI</h2>
        <p>
          The Desk uses large language models to support the editorial
          workflow, specifically to draft per-persona angles ("Say This"
          lines, partner-tag rows) once a story has been selected and
          summarised. The story selection, the framing, and the editor's
          take are human judgements. The AI does not pick stories, decide
          what's important, or write the long-form editorial pieces. Any
          paragraph that's substantially LLM-drafted is labelled.
        </p>

        <h2 className="font-serif text-2xl mt-8">Conflicts of interest</h2>
        <p>
          Ruben may comment on markets, brokers, lenders or research firms
          with whom he has a commercial relationship. Where that matters to a
          specific story, the story carries a disclosure footer. When in
          doubt, we err toward disclosure.
        </p>

        <h2 className="font-serif text-2xl mt-8">Corrections</h2>
        <p>
          We correct factual errors openly and quickly. Material updates to
          a published story carry an "Updated" timestamp and a brief note
          on what changed. Reply to any brief to flag an error and you'll
          get a same-day response.
        </p>

        <h2 className="font-serif text-2xl mt-8">Not financial advice</h2>
        <p>
          The Desk publishes general information and editorial commentary.
          Nothing here is personal financial, tax, legal or property
          advice. Always check your circumstances with a qualified
          professional before acting.
        </p>
      </section>
    </article>
  );
}
