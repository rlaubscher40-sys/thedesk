/**
 * Founding-member capture panel — the premium-tier counterpart to
 * SubscribeCallout. Shown to readers who are already on the free list (the
 * warm segment) so the funnel reads free-first, then premium: we never pitch
 * a paid tier to someone who hasn't yet taken the free one.
 *
 * It captures interest through the same double-opt-in `subscribers.subscribe`
 * mutation the free surfaces use, tagged with a founding `source` so the admin
 * can count willingness-to-pay. It does NOT take payment — copy says so plainly.
 * Billing is a later, Substack-backed step; this validates demand and warms a
 * launch list first.
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Crown } from "lucide-react";
import { toast } from "sonner";
import { Honeypot } from "@/components/Honeypot";
import { useSubscribe } from "@/lib/useSubscribe";
import { FOUNDING_CAP, FOUNDING_PRICE, PREMIUM_CADENCE, PREMIUM_PRICE } from "@/lib/premium";

const FOUNDING_KEY = "thedesk:founding";

/** True once a founding-interest form on this device completed. Keeps the
 *  inline edition-foot upsell from re-pitching someone who already raised
 *  their hand. */
export function hasFoundingInterest(): boolean {
  try {
    return window.localStorage.getItem(FOUNDING_KEY) === "1";
  } catch {
    return false;
  }
}

function markFoundingInterest(): void {
  try {
    window.localStorage.setItem(FOUNDING_KEY, "1");
  } catch {
    // Private browsing — the flag is a nicety, not state.
  }
}

export function FoundingMemberCTA({
  source,
  compact = false,
  showLearnMore = false,
}: {
  /** Attribution string persisted with the subscriber row. */
  source: string;
  /** Tighter register for the edition foot vs the standalone page. */
  compact?: boolean;
  /** Show a "how Premium works" link through to /founding (used inline). */
  showLearnMore?: boolean;
}) {
  const [done, setDone] = useState(false);
  const {
    email,
    setEmail,
    hp,
    setHp,
    submit: onSubmit,
    busy,
  } = useSubscribe({
    source,
    onSubscribed: () => {
      markFoundingInterest();
      setDone(true);
      toast.success("Founding spot held — confirm the email to lock it in");
    },
  });

  return (
    <aside
      className="relative overflow-hidden rounded-sm panel"
      role="complementary"
      aria-label="Become a founding member of The Desk"
      style={{
        background: "var(--grad-cta-deep)",
        boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 18%), 0 14px 40px oklch(0 0 0 / 30%)",
      }}
    >
      <div
        className="absolute -top-12 -right-12 h-48 w-48 pointer-events-none rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.75 0.18 70 / 38%) 0%, transparent 70%)",
          filter: "blur(28px)",
        }}
        aria-hidden="true"
      />
      <div
        className={`relative grid items-center gap-7 sm:gap-10 ${
          compact
            ? "p-6 sm:p-8 sm:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]"
            : "p-7 sm:p-10 lg:p-14 sm:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]"
        }`}
      >
        <div>
          <p className="overline-amber mb-3" style={{ letterSpacing: "0.26em", fontSize: "10px" }}>
            <Crown className="inline h-3 w-3 mr-1 -mt-px" />
            The Desk · Premium
          </p>
          <h2
            className="font-serif font-bold tracking-tight leading-[1.02] mb-3"
            style={{
              fontSize: compact ? "clamp(1.4rem, 2.6vw, 2rem)" : "clamp(1.75rem, 3.6vw, 2.75rem)",
            }}
          >
            Become a founding member
          </h2>
          <p
            className="text-[var(--color-fg-muted)] leading-relaxed max-w-[54ch]"
            style={{ fontSize: compact ? "14.5px" : "15.5px" }}
          >
            The brief stays free. Premium is the full read behind it: Ruben's Take on every story,
            the deal-relevant call, the Sunday deep dives. The first {FOUNDING_CAP} founding members
            lock {FOUNDING_PRICE}
            {PREMIUM_CADENCE} for life, below the {PREMIUM_PRICE}
            {PREMIUM_CADENCE} it opens at.
          </p>
          <ul className="mt-5 flex gap-x-6 gap-y-2 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            <li>No charge today</li>
            <li>Founding rate locked for life</li>
            <li>Cancel anytime</li>
          </ul>
          {showLearnMore && (
            <Link
              href="/founding"
              className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-[0.18em] text-[var(--color-amber)] hover:underline"
            >
              How Premium works
              <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
            </Link>
          )}
        </div>

        {done ? (
          <div
            className="rounded-sm p-5 text-sm"
            style={{
              background: "oklch(0.72 0.17 155 / 8%)",
              boxShadow: "inset 0 0 0 1px oklch(0.72 0.17 155 / 30%)",
              color: "oklch(0.85 0.10 155)",
            }}
            aria-live="polite"
          >
            <p className="font-serif text-lg mb-1">Your founding spot is held.</p>
            <p className="text-[13px] leading-relaxed">
              Confirm the email we just sent to lock it in. We'll be in touch the moment Premium
              opens, and you won't be charged before then.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
            <Honeypot value={hp} onChange={setHp} />
            <label htmlFor={`founding-${source}`} className="sr-only">
              Email address
            </label>
            <input
              id={`founding-${source}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className="px-4 py-3 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/60 transition-colors"
              style={{ fontSize: "15px" }}
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded text-[11px] font-mono uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: "var(--grad-cta-amber)",
                color: "var(--color-on-amber)",
                boxShadow: "0 1px 0 oklch(1 0 0 / 18%) inset, 0 6px 20px oklch(0.75 0.18 70 / 30%)",
              }}
            >
              {busy ? (
                <>Holding your spot…</>
              ) : (
                <>
                  Claim a founding spot
                  <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                </>
              )}
            </button>
            <p className="text-[11px] text-[var(--color-fg-subtle)] leading-snug text-center">
              Registers your interest. No payment now.
            </p>
          </form>
        )}
      </div>
    </aside>
  );
}
