/**
 * Terms of use. Plain-language. The audience is regulated and reads carefully.
 */
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function Terms() {
  useDocumentTitle("Terms of use");
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
          Terms of use
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Last updated: {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl mt-8">General information only</h2>
        <p>
          The Desk is an editorial product. Everything published here is
          general information and commentary, not personal financial, tax,
          legal or property advice. We don't know your specific
          circumstances and we can't account for them. Before acting on
          anything you read here, talk to a qualified professional.
        </p>

        <h2 className="font-serif text-2xl mt-8">Sources and accuracy</h2>
        <p>
          We summarise and link out to original sources where we can.
          Reasonable care is taken with facts and figures, but we don't
          warrant accuracy or completeness. If you spot a material error,
          reply to any brief and we'll correct it openly.
        </p>

        <h2 className="font-serif text-2xl mt-8">Use of content</h2>
        <p>
          You're welcome to quote, share or paste excerpts from The Desk
          into client conversations, internal notes, LinkedIn posts and
          presentations, that's literally what the "Say This" feature is
          for. Republishing whole stories or editions without attribution
          isn't OK.
        </p>

        <h2 className="font-serif text-2xl mt-8">No liability</h2>
        <p>
          To the maximum extent allowed by law, neither Ruben Laubscher nor
          InvestorKit accepts liability for any loss arising from reliance
          on anything published on The Desk.
        </p>

        <h2 className="font-serif text-2xl mt-8">Changes</h2>
        <p>
          These terms can change. The "last updated" date at the top of the
          page tells you when. Continuing to use the site after a change
          means you accept the revised terms.
        </p>
      </section>
    </article>
  );
}
