/**
 * The Desk Premium — founding-member landing page (/founding).
 *
 * The full pitch behind the inline FoundingMemberCTA: the free vs paid split,
 * the founding offer, and an honest FAQ. Positioning is give-away-the-news,
 * sell-the-judgment — the brief stays free, Premium is Ruben's read.
 *
 * No payment is taken here. The page captures founding interest through the
 * shared double-opt-in subscribe flow; billing is a later Substack step.
 */
import { Check, Minus } from "lucide-react";
import { FoundingMemberCTA } from "@/components/FoundingMemberCTA";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
  FOUNDING_CAP,
  FOUNDING_PRICE,
  FOUNDING_SOURCE_PAGE,
  FREE_TIER,
  PREMIUM_CADENCE,
  PREMIUM_PRICE,
  PREMIUM_TIER,
} from "@/lib/premium";

export default function Founding() {
  useDocumentTitle("Become a founding member");

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="max-w-3xl">
        <p className="overline-amber mb-4" style={{ letterSpacing: "0.26em", fontSize: "10px" }}>
          The Desk · Premium
        </p>
        <h1
          className="font-serif font-bold tracking-tight leading-[1.04] mb-5"
          style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)" }}
        >
          The brief is free. The judgment is Premium.
        </h1>
        <p
          className="text-[var(--color-fg-muted)] leading-relaxed max-w-[60ch]"
          style={{ fontSize: "17px" }}
        >
          Anyone can summarise the week's property news. A machine can do that now. What it can't do
          is tell you what a rate call means for a buyer this Tuesday, or which soft number is the
          one that matters. That read is what Premium is. We're opening it to a first group of
          founding members before it goes public.
        </p>
      </section>

      {/* Free vs Premium comparison */}
      <section className="grid gap-5 sm:grid-cols-2 max-w-4xl" aria-label="What each tier includes">
        <div className="rounded-sm panel p-7 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-subtle)] mb-2">
            Free · always
          </p>
          <p className="font-serif text-2xl font-bold mb-5">The Brief</p>
          <ul className="space-y-3">
            {FREE_TIER.map((item) => (
              <li key={item} className="flex gap-3 text-[14.5px] text-[var(--color-fg-muted)]">
                <Check
                  className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-amber)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
            {PREMIUM_TIER.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-[14.5px] text-[var(--color-fg-subtle)] opacity-55"
              >
                <Minus className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="relative overflow-hidden rounded-sm panel p-7 sm:p-8"
          style={{ boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 30%)" }}
        >
          <div
            className="absolute -top-10 -right-10 h-40 w-40 pointer-events-none rounded-full"
            style={{
              background: "radial-gradient(circle, oklch(0.75 0.18 70 / 30%) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
            aria-hidden="true"
          />
          <p
            className="relative overline-amber mb-2"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Premium · founding rate
          </p>
          <p className="relative font-serif text-2xl font-bold mb-1">The Desk Premium</p>
          <p className="relative mb-5 text-[13px] text-[var(--color-fg-muted)]">
            <span className="font-mono text-[var(--color-fg)] text-base">
              {FOUNDING_PRICE}
              <span className="text-[var(--color-fg-subtle)]">{PREMIUM_CADENCE}</span>
            </span>{" "}
            for founding members, then {PREMIUM_PRICE}
            {PREMIUM_CADENCE}.
          </p>
          <ul className="relative space-y-3">
            {FREE_TIER.map((item) => (
              <li key={item} className="flex gap-3 text-[14.5px] text-[var(--color-fg-muted)]">
                <Check
                  className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-amber)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
            {PREMIUM_TIER.map((item) => (
              <li key={item} className="flex gap-3 text-[14.5px] text-[var(--color-fg)]">
                <Check
                  className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-amber)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Capture */}
      <section className="max-w-4xl">
        <FoundingMemberCTA source={FOUNDING_SOURCE_PAGE} />
      </section>

      {/* Honest FAQ */}
      <section className="max-w-3xl space-y-6" aria-label="Founding member questions">
        <h2 className="font-serif text-2xl font-bold">Straight answers</h2>
        <div className="space-y-5">
          <div>
            <p className="font-semibold text-[15px] mb-1">Am I being charged now?</p>
            <p className="text-[14.5px] text-[var(--color-fg-muted)] leading-relaxed">
              No. Claiming a founding spot puts you on the founding list and holds the{" "}
              {FOUNDING_PRICE}
              {PREMIUM_CADENCE} rate. You'll get an email when Premium opens, and nothing is billed
              before you choose to join.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[15px] mb-1">
              What does "founding rate for life" mean?
            </p>
            <p className="text-[14.5px] text-[var(--color-fg-muted)] leading-relaxed">
              The first {FOUNDING_CAP} members keep {FOUNDING_PRICE}
              {PREMIUM_CADENCE} for as long as they stay subscribed, even after the public price
              rises. It's our thank-you for backing The Desk early.
            </p>
          </div>
          <div>
            <p className="font-semibold text-[15px] mb-1">Does the free brief change?</p>
            <p className="text-[14.5px] text-[var(--color-fg-muted)] leading-relaxed">
              No. The daily brief and the Sunday headlines stay free, for everyone, always. Premium
              adds the deeper read on top. It never takes anything away.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
