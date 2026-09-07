import { Link } from "wouter";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function Subscribe() {
  useDocumentTitle("The free daily brief");
  return (
    <div className="pb-10">
      <section className={`${GUTTER_X} pt-10 max-w-4xl`}>
        <p className="bs-label-accent">The Desk · In your inbox</p>
        <h1 className="font-serif text-4xl sm:text-6xl leading-tight mt-4">
          Know what changed. See why it matters.
        </h1>
        <p className="text-lg leading-8 mt-5 text-[var(--color-fg-muted)] max-w-2xl">
          Australian property, credit and the economy, in one weekday morning read. Follow the
          evidence behind the headlines, then open The Desk to explore it further.
        </p>
      </section>
      <SubscribeBand
        source="subscribe-page"
        kicker="The daily brief · free"
        headline="Get the next briefing."
        blurb="Enter your email, then confirm using the link in your inbox. The national briefing arrives at 7am AEST on weekdays, with the weekly edition on Sunday. Unsubscribe any time."
        showHeadshot={false}
        hideAfterSignup={false}
      />
      <section className={`${GUTTER_X} mt-8 max-w-3xl`} aria-label="About your subscription">
        <p className="text-sm leading-7 text-[var(--color-fg-muted)]">
          This is the national email briefing. It does not create city-specific alerts or a paid
          subscription. Already requested it? Check your spam folder, or use the form above to
          request a fresh confirmation email. Requesting an email is not confirmation.
        </p>
        <p className="mt-5 text-sm">
          <Link href="/privacy" className="bs-link underline">
            Privacy
          </Link>
          {" · "}
          <Link href="/" className="bs-link underline">
            Read today's briefing
          </Link>
          {" · "}
          <Link href="/markets/compare/brisbane-vs-perth" className="bs-link underline">
            Explore Brisbane vs Perth
          </Link>
        </p>
      </section>
    </div>
  );
}
