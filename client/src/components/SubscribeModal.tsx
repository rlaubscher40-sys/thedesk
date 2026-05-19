/**
 * First-visit Subscribe modal.
 *
 * Triggers when the reader has clearly engaged with the content, past
 * the lead card and at least 1.4 viewport-heights into the feed —
 * rather than on a blind 30-second timer. The earlier timing felt
 * aggressive in tester feedback: it kept interrupting people mid-
 * scroll while they were still assessing the product.
 *
 * Backstop: a 90-second timer fires the modal anyway, so passive
 * readers who never scroll (open in a tab and come back later) still
 * see it once. Shown ONCE per device, regardless of which trigger
 * fires first.
 *
 * The form captures the email through tRPC (double-opt-in) and stays
 * in-app to show the "check your inbox" confirmation state, no
 * hand-off to Substack mid-flow. Substack is offered as a separate
 * "Read the long-form essays" link below the form for users who
 * already use it.
 *
 * Either dismissing or completing the form marks the modal dismissed
 * permanently.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Rss, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Honeypot } from "@/components/Honeypot";
import { Logomark } from "@/components/Logomark";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "thedesk:subscribe-modal-seen";
const SUBSTACK_URL = "https://rubenlaubscher.substack.com/";
/** Backstop timer for readers who never scroll, open the tab, leave
 *  it, come back. 90s is long enough that scroll-engaged readers hit
 *  the scroll trigger first. */
const BACKSTOP_DELAY_MS = 90_000;
/** Scroll distance (in viewport heights) before the modal fires. ~1.4
 *  vh puts the reader past the lead card and into the stacked feed —
 *  they've seen enough of the product to make a real subscribe
 *  decision. */
const SCROLL_TRIGGER_VH = 1.4;

export function SubscribeModal() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (location !== "/") return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;

    let fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      setOpen(true);
    }

    function onScroll() {
      const threshold = window.innerHeight * SCROLL_TRIGGER_VH;
      if (window.scrollY >= threshold) fire();
    }

    const backstop = window.setTimeout(fire, BACKSTOP_DELAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(backstop);
      window.removeEventListener("scroll", onScroll);
    };
  }, [location]);

  function dismiss(reason: "later" | "subscribed") {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
    if (reason === "later") {
      toast.message("No worries", {
        description: "Subscribe button stays in the sidebar if you change your mind.",
      });
    }
  }

  const subscribeMut = trpc.subscribers.subscribe.useMutation({
    onSuccess: () => setDone(true),
    onError: () => {
      toast.error("Couldn't subscribe. Try again in a minute.");
    },
  });

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      toast.error("That email doesn't look right");
      return;
    }
    subscribeMut.mutate({ email, source: "first-visit-modal", _hp: hp });
  }

  const busy = subscribeMut.isPending;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      onClick={() => dismiss(done ? "subscribed" : "later")}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-lg panel rounded-sm shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="subscribe-modal-title"
      >
        <div
          className="relative h-32 overflow-hidden"
          style={{ background: "var(--grad-modal-bg)" }}
          aria-hidden="true"
        >
          <span className="absolute inset-0 noise-overlay" style={{ opacity: 0.5 }} />
          {done ? (
            <CheckCircle2 className="absolute top-6 left-7 h-8 w-8 text-amber-300/80" strokeWidth={1.4} />
          ) : (
            <div className="absolute top-6 left-7">
              <Logomark size={32} animated={false} />
            </div>
          )}
        </div>

        <button
          onClick={() => dismiss(done ? "subscribed" : "later")}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-7 sm:p-9">
          {done ? (
            <>
              <p
                className="overline-amber mb-3"
                style={{ letterSpacing: "0.22em", fontSize: "10px" }}
              >
                One more step
              </p>
              <h2
                id="subscribe-modal-title"
                className="font-serif text-3xl sm:text-4xl font-bold leading-tight mb-3"
              >
                Check your inbox.
              </h2>
              <p className="text-base text-[var(--color-fg-muted)] leading-relaxed mb-6">
                A confirmation link is on its way to <span className="text-[var(--color-fg)]">{email}</span>. Click it to lock in your subscription, it expires in 24 hours.
              </p>
              <button
                onClick={() => dismiss("subscribed")}
                className="rounded-sm px-4 py-2.5 text-xs font-mono uppercase tracking-[0.18em] transition-colors hover:bg-white/5"
                style={{ boxShadow: "inset 0 0 0 1px var(--color-border)" }}
              >
                Got it
              </button>
            </>
          ) : (
            <>
              <p
                className="overline-amber mb-3"
                style={{ letterSpacing: "0.22em", fontSize: "10px" }}
              >
                From Ruben's desk
              </p>
              <h2
                id="subscribe-modal-title"
                className="font-serif text-3xl sm:text-4xl font-bold leading-tight mb-3"
              >
                Get the weekly edition in your inbox.
              </h2>
              <p className="text-base text-[var(--color-fg-muted)] leading-relaxed mb-6">
                One long-form essay on Sundays. The Daily Brief on weekdays. No spam, no broadcast, just the stories I think a partner conversation should know about.
              </p>

              <form onSubmit={subscribe} className="space-y-2.5">
                <Honeypot value={hp} onChange={setHp} />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@firm.com"
                  className="w-full px-4 py-3 rounded-sm text-base bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors"
                  aria-label="Email address"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-xs font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50 text-[var(--color-on-amber)]"
                    style={{
                      background: "var(--grad-cta-amber)",
                      boxShadow:
                        "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px var(--color-amber-glow)",
                    }}
                  >
                    <Rss className="h-3.5 w-3.5" />
                    {busy ? "Subscribing…" : "Subscribe, it's free"}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss("later")}
                    className="px-4 py-3 rounded-sm text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
              </form>

              <a
                href={SUBSTACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-5 text-xs text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
              >
                Or read the long-form essays on Substack <ExternalLink className="h-3 w-3" />
              </a>

              <p
                className="overline mt-6 text-[var(--color-fg-subtle)]"
                style={{ letterSpacing: "0.18em" }}
              >
                By Ruben Laubscher · Head of Partnerships · InvestorKit
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
