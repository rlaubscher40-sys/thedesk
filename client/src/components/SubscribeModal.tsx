/**
 * First-visit Subscribe modal.
 *
 * Appears 30 seconds after the user lands on the Today page, ONCE
 * per device. Either action — Subscribe / Maybe later — marks the
 * modal dismissed permanently. The Subscribe button opens Ruben's
 * Substack in a new tab.
 *
 * Light email-capture form is included; submitting it stores the
 * email locally (placeholder for a real subscribe endpoint) and
 * routes the user to the Substack publication with the email
 * pre-filled in the URL.
 */
import { useEffect, useState } from "react";
import { Rss, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STORAGE_KEY = "thedesk:subscribe-modal-seen";
const SUBSTACK_URL = "https://rubenlaubscher.substack.com/";
const SHOW_DELAY_MS = 30_000;

export function SubscribeModal() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Only trigger on the Today page so it doesn't interrupt deeper
    // navigation.
    if (location !== "/") return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;

    const t = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
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

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      toast.error("That email doesn't look right");
      return;
    }
    setBusy(true);
    // Open Substack with the email pre-filled — Substack accepts the
    // `?email=` query param on the subscribe form.
    const url = `${SUBSTACK_URL}?email=${encodeURIComponent(email)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => {
      setBusy(false);
      dismiss("subscribed");
      toast.success("Finish on Substack — opened in a new tab");
    }, 400);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      onClick={() => dismiss("later")}
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
        {/* Photographic header — same hero style as About. */}
        <div
          className="relative h-32 overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 78% 22%, oklch(0.78 0.18 70 / 35%) 0%, transparent 55%), linear-gradient(135deg, oklch(0.16 0.022 260), oklch(0.08 0.022 260))",
          }}
          aria-hidden="true"
        >
          <span className="absolute inset-0 noise-overlay" style={{ opacity: 0.5 }} />
          <Sparkles className="absolute top-6 left-7 h-8 w-8 text-amber-300/80" strokeWidth={1.4} />
        </div>

        <button
          onClick={() => dismiss("later")}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-7 sm:p-9">
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
            One long-form essay on Sundays. The Daily Brief on weekdays. No spam, no
            broadcast — just the stories I think a partner conversation should know about.
          </p>

          <form onSubmit={subscribe} className="space-y-2.5">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className="w-full px-4 py-3 rounded-sm text-base bg-black/30 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
              aria-label="Email address"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 text-xs font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
                  color: "oklch(0.10 0.018 260)",
                  boxShadow:
                    "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px oklch(0.75 0.18 70 / 28%)",
                }}
              >
                <Rss className="h-3.5 w-3.5" />
                {busy ? "Opening Substack…" : "Subscribe — it's free"}
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

          <p
            className="overline mt-6 text-[var(--color-fg-subtle)]"
            style={{ letterSpacing: "0.18em" }}
          >
            By Ruben Laubscher · Head of Partnerships · InvestorKit
          </p>
        </div>
      </div>
    </div>
  );
}
