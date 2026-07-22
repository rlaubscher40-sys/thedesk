/**
 * Lead-magnet landing page (/free/:slug). Renders a gated resource from the
 * shared LEAD_MAGNETS config and captures an email in exchange for it.
 *
 * The point of this page is top-of-funnel: it's the destination for a
 * LinkedIn/Instagram CTA, turning a scroller into a confirmed email
 * subscriber. On submit it calls subscribers.requestLeadMagnet, which emails
 * a link that both confirms the address and delivers the asset.
 *
 * Unknown slug → NotFound, so a stale link doesn't render an empty shell.
 */
import { useState } from "react";
import { useParams } from "wouter";
import { ArrowRight, Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { Honeypot } from "@/components/Honeypot";
import { trpc } from "@/lib/trpc";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { getLeadMagnet } from "@shared/leadMagnets";
import NotFound from "./NotFound";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LeadMagnet() {
  const params = useParams<{ slug: string }>();
  const magnet = getLeadMagnet(params.slug ?? "");

  useDocumentTitle(magnet ? magnet.title : "Free resource");

  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = trpc.subscribers.requestLeadMagnet.useMutation({
    onSuccess: () => {
      setSent(true);
      toast.success("Check your inbox", { description: "Your download link is on its way." });
    },
    onError: () => toast.error("Couldn't send that just now. Try again in a minute."),
  });

  // Hooks must run before any early return, so the unknown-slug guard sits
  // here rather than at the top.
  if (!magnet) return <NotFound />;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      toast.error("That email doesn't look right");
      return;
    }
    mutation.mutate({ email, slug: magnet!.slug, _hp: hp });
  }

  return (
    <div className="max-w-4xl grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
      {/* The pitch */}
      <section>
        <p className="overline-amber mb-4" style={{ letterSpacing: "0.26em", fontSize: "10px" }}>
          <Mail className="inline h-3 w-3 mr-1 -mt-px" />
          The Desk · Free resource
        </p>
        <h1
          className="font-serif font-bold tracking-tight leading-[1.04] mb-4"
          style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}
        >
          {magnet.title}
        </h1>
        <p
          className="text-[var(--color-fg)] leading-relaxed mb-3 max-w-[54ch]"
          style={{ fontSize: "18px" }}
        >
          {magnet.tagline}
        </p>
        <p
          className="text-[var(--color-fg-muted)] leading-relaxed max-w-[58ch]"
          style={{ fontSize: "15.5px" }}
        >
          {magnet.description}
        </p>

        <ul className="mt-7 space-y-3">
          {magnet.bullets.map((b) => (
            <li key={b} className="flex gap-3 text-[15px] text-[var(--color-fg-muted)]">
              <Check
                className="h-4 w-4 mt-1 shrink-0 text-[var(--color-amber)]"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* The capture */}
      <aside
        className="relative overflow-hidden rounded-sm panel p-6 sm:p-7 lg:sticky lg:top-8"
        role="complementary"
        aria-label={`Get ${magnet.title}`}
        style={{
          background: "var(--grad-cta-deep)",
          boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 16%), 0 14px 40px oklch(0 0 0 / 30%)",
        }}
      >
        <div
          className="absolute -top-12 -right-12 h-40 w-40 pointer-events-none rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.75 0.18 70 / 32%) 0%, transparent 70%)",
            filter: "blur(28px)",
          }}
          aria-hidden="true"
        />
        {sent ? (
          <div className="relative" aria-live="polite">
            <p className="font-serif text-xl font-bold mb-2">Check your inbox.</p>
            <p className="text-[14px] text-[var(--color-fg-muted)] leading-relaxed">
              We've sent your download link. Open it to get {magnet.assetNoun} and start the daily
              brief. If it's not there in a minute, check spam.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="relative flex flex-col gap-3">
            <p className="font-serif text-xl font-bold leading-snug">
              Get {magnet.assetNoun}, free.
            </p>
            <p className="text-[13.5px] text-[var(--color-fg-muted)] leading-relaxed -mt-1">
              Enter your email and we'll send it over. You'll also get the free daily brief.
              One-click unsubscribe, no spam.
            </p>
            <Honeypot value={hp} onChange={setHp} />
            <label htmlFor="lead-magnet-email" className="sr-only">
              Email address
            </label>
            <input
              id="lead-magnet-email"
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
              disabled={mutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded text-[11px] font-mono uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: "var(--grad-cta-amber)",
                color: "var(--color-on-amber)",
                boxShadow: "0 1px 0 oklch(1 0 0 / 18%) inset, 0 6px 20px oklch(0.75 0.18 70 / 30%)",
              }}
            >
              {mutation.isPending ? (
                <>Sending…</>
              ) : (
                <>
                  Send it to me
                  <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
