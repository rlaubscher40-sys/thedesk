import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Honeypot } from "@/components/Honeypot";
import { trpc } from "@/lib/trpc";

export function SubscribeBanner({ source = "banner" }: { source?: string }) {
  const [expanded, setExpanded] = useState(false);
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
      {/* Warm amber glow from the right, mirrors the screenshot */}
      <div
        className="absolute -bottom-16 -right-16 h-80 w-80 pointer-events-none rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.72 0.20 55 / 40%) 0%, transparent 70%)",
          filter: "blur(48px)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute top-0 right-1/4 h-48 w-48 pointer-events-none rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.75 0.18 70 / 20%) 0%, transparent 70%)",
          filter: "blur(36px)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center text-center px-8 py-14 sm:px-16 sm:py-18 lg:py-20 gap-6">
        <p
          className="overline-amber"
          style={{ letterSpacing: "0.26em", fontSize: "10px" }}
        >
          Keep getting The Desk
        </p>

        <h2
          className="font-serif font-bold tracking-tight leading-[1.05]"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.8rem)", maxWidth: "24ch" }}
        >
          One edition every Sunday. Seven at the start of every weekday.
        </h2>

        <p
          className="text-[var(--color-fg-muted)] leading-relaxed"
          style={{ fontSize: "15px", maxWidth: "46ch" }}
        >
          Property partner intelligence, written for the conversation you are
          about to have with a client.
        </p>

        {subscribed ? (
          <div
            className="mt-2 rounded-sm px-6 py-4 text-sm text-center"
            style={{
              background: "oklch(0.72 0.17 155 / 8%)",
              boxShadow: "inset 0 0 0 1px oklch(0.72 0.17 155 / 30%)",
              color: "oklch(0.85 0.10 155)",
            }}
            aria-live="polite"
          >
            <p className="font-serif text-lg mb-1">You're nearly on the list.</p>
            <p className="text-[13px] leading-relaxed">
              Check your inbox and click the confirm link.
            </p>
          </div>
        ) : expanded ? (
          <form
            onSubmit={onSubmit}
            className="mt-2 flex flex-col sm:flex-row gap-2.5 w-full max-w-sm"
          >
            <Honeypot value={hp} onChange={setHp} />
            <label htmlFor="subscribe-banner" className="sr-only">
              Email address
            </label>
            <input
              id="subscribe-banner"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className="flex-1 px-4 py-3 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/60 transition-colors"
              style={{ fontSize: "15px" }}
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded text-[11px] font-mono uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-60 shrink-0"
              style={{
                background: "var(--grad-cta-amber)",
                color: "var(--color-on-amber)",
                boxShadow:
                  "0 1px 0 oklch(1 0 0 / 18%) inset, 0 6px 20px oklch(0.75 0.18 70 / 30%)",
              }}
            >
              {busy ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="mt-2 inline-flex items-center gap-2 px-7 py-3.5 rounded text-[11px] font-mono uppercase tracking-[0.22em] transition-all active:scale-[0.98]"
            style={{
              background: "var(--grad-cta-amber)",
              color: "var(--color-on-amber)",
              boxShadow:
                "0 1px 0 oklch(1 0 0 / 18%) inset, 0 8px 24px oklch(0.75 0.18 70 / 36%)",
            }}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
            Subscribe to Ruben
          </button>
        )}
      </div>
    </aside>
  );
}
