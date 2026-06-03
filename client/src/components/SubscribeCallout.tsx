/**
 * Editorial Subscribe panel. Designed as a deliberate "you've just read 10
 * minutes of analysis, here's how to keep getting it" beat at the bottom
 * of long reads. Bigger, more confident than the sidebar rail card; the
 * highest-conversion surface in the product.
 *
 * Posts the email to the existing `subscribers.subscribe` tRPC mutation
 * with the `source` parameter set so the admin can attribute conversions
 * to a specific page (edition-foot, story-foot, etc.).
 */
import { useState } from "react";
import { Honeypot } from "@/components/Honeypot";
import { ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Variant = "edition" | "story";

export function SubscribeCallout({
  source,
  variant = "edition",
  headline,
  subhead,
}: {
  /** Attribution source string. */
  source: string;
  /** Visual register. Edition = post-deep-read, story = post-short-read. */
  variant?: Variant;
  headline?: string;
  subhead?: string;
}) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const subscribe = trpc.subscribers.subscribe.useMutation({
    onSuccess: (res) => {
      setEmail("");
      setSubscribed(true);
      if (res.status === "already-confirmed") {
        toast.success("You're already on the list");
      } else {
        toast.success("Check your inbox to confirm");
      }
    },
    onError: () => {
      toast.error("Couldn't subscribe right now. Try again in a minute.");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      toast.error("That email doesn't look right");
      return;
    }
    subscribe.mutate({ email, source, _hp: hp });
  }

  const busy = subscribe.isPending;

  // Edition: full-bleed-feel panel, big serif headline, two-row layout.
  // Story: tighter, single-row, sized for the end of a 4-min read.
  const isEdition = variant === "edition";

  const defaultHeadline = isEdition
    ? "Get next Sunday's edition"
    : "Read the next one with us";
  const defaultSubhead = isEdition
    ? "Weekly intelligence on Australian property, in your inbox at 7am AEST Sunday. The daily brief lands every weekday."
    : "The daily brief lands at 7am AEST. Same eye, same voice, in your inbox.";

  return (
    <aside
      className="relative overflow-hidden rounded-sm panel"
      role="complementary"
      aria-label="Subscribe to The Desk"
      style={{
        background: "var(--grad-cta-deep)",
        boxShadow:
          "inset 0 0 0 1px oklch(0.75 0.18 70 / 14%), 0 14px 40px oklch(0 0 0 / 30%)",
      }}
    >
      {/* Amber wash in the corner, anchors the eye. */}
      <div
        className="absolute -top-12 -right-12 h-48 w-48 pointer-events-none rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.75 0.18 70 / 35%) 0%, transparent 70%)",
          filter: "blur(28px)",
        }}
        aria-hidden="true"
      />
      <div
        className={`relative grid items-center gap-7 sm:gap-10 ${
          isEdition
            ? "p-7 sm:p-10 lg:p-14 sm:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]"
            : "p-6 sm:p-8 sm:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]"
        }`}
      >
        <div>
          <p
            className="overline-amber mb-3"
            style={{ letterSpacing: "0.26em", fontSize: "10px" }}
          >
            <Mail className="inline h-3 w-3 mr-1 -mt-px" />
            The Desk · Subscribe
          </p>
          <h2
            className="font-serif font-bold tracking-tight leading-[1.02] mb-3"
            style={{
              fontSize: isEdition
                ? "clamp(1.75rem, 3.6vw, 2.75rem)"
                : "clamp(1.4rem, 2.6vw, 2rem)",
            }}
          >
            {headline ?? defaultHeadline}
          </h2>
          <p
            className="text-[var(--color-fg-muted)] leading-relaxed max-w-[52ch]"
            style={{ fontSize: isEdition ? "15.5px" : "14.5px" }}
          >
            {subhead ?? defaultSubhead}
          </p>
          <ul className="mt-5 flex gap-x-6 gap-y-2 flex-wrap font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            <li>Free</li>
            <li>One-click unsubscribe</li>
            <li>No spam</li>
          </ul>
        </div>

        {subscribed ? (
          <div
            className="rounded-sm p-5 text-sm"
            style={{
              background: "oklch(0.72 0.17 155 / 8%)",
              boxShadow: "inset 0 0 0 1px oklch(0.72 0.17 155 / 30%)",
              color: "oklch(0.85 0.10 155)",
            }}
            aria-live="polite"
          >
            <p className="font-serif text-lg mb-1">You're nearly on the list.</p>
            <p className="text-[13px] leading-relaxed">
              Check your inbox and click the confirm link. The next edition
              lands Sunday 7am.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
            <Honeypot value={hp} onChange={setHp} />
            <label htmlFor={`subscribe-${source}`} className="sr-only">
              Email address
            </label>
            <input
              id={`subscribe-${source}`}
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
                background:
                  "var(--grad-cta-amber)",
                color: "var(--color-on-amber)",
                boxShadow:
                  "0 1px 0 oklch(1 0 0 / 18%) inset, 0 6px 20px oklch(0.75 0.18 70 / 30%)",
              }}
            >
              {busy ? (
                <>Subscribing…</>
              ) : (
                <>
                  Subscribe
                  <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
