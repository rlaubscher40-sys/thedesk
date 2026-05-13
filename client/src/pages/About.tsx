/**
 * About page. Static editorial copy explaining what The Desk is and how to use
 * it. Read once, ignored thereafter.
 */
import { PageHeader } from "@/components/PageHeader";

export default function About() {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        overline="The Desk · About"
        title="What this is"
        kicker="A private intelligence briefing for Ruben Laubscher and the InvestorKit partner network."
      />

      <div className="prose prose-invert max-w-none text-[var(--color-fg)] space-y-5 leading-relaxed">
        <p>
          The Desk runs two scans. The daily one lands at 7am AEST with five stories the partner
          channel should know about, each tagged for the four personas Ruben works with: Brokers,
          Financial Advisers, Accountants, SMSF Specialists.
        </p>
        <p>
          Sundays the weekly edition lands. Long-form pieces, market metrics, signals worth tracking
          and Ruben's Take — a 2 to 4 sentence editorial opinion that opens the issue. From there a
          full Substack draft is one click away.
        </p>

        <h2 className="font-serif text-xl mt-8">How to use it</h2>
        <ul className="space-y-2">
          <li>Open Today first thing. Copy a Say This line into a partner conversation.</li>
          <li>Drop saved articles into the Reading Queue. They sync to your account.</li>
          <li>End the week in Notes. The lessons compound when you write them down.</li>
          <li>Press <kbd className="font-mono px-1.5 py-0.5 rounded bg-white/5 text-xs">/</kbd> anywhere to search.</li>
        </ul>

        <h2 className="font-serif text-xl mt-8">Built for the partner channel</h2>
        <p>
          Information density is the point. The Desk should make a partner conversation
          measurably sharper. If a page is making you scroll past whitespace, the page is wrong.
        </p>
      </div>
    </div>
  );
}
