/**
 * Cinematic Today-page hero.
 *
 *   ● LIVE FEED · FRIDAY 15 MAY 2026 · 7AM AEST DAILY
 *   THE DESK / DAILY INTELLIGENCE BRIEF
 *   Today's
 *   Desk.  ← in gold
 *   "What's cutting through right now…"
 *   BY RUBEN LAUBSCHER
 *   [✦ GEN ALL SAY THIS]
 *
 * Backed by /public/hero.jpg with a gradient veil + film-grain overlay.
 */
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/Logomark";
import { getSydneyDate } from "@/lib/date";
import { useAuth } from "@/lib/useAuth";
import { useLiveEditionMeta } from "@/lib/useLiveEditionMeta";

export function Hero({ onGenerateAll }: { onGenerateAll?: () => void }) {
  // Today's date in Sydney + the latest live edition's number, both
  // pulled from real data rather than the static seed editionMeta. The
  // edition link still lands on the newest edition.
  const todayLabel = getSydneyDate();
  const edition = useLiveEditionMeta();
  // "Gen all Say This" is an editorial-side rerun control, it asks the
  // server to regenerate the persona-tailored line on every story. Not
  // something a partner reader should ever see, so gate on admin.
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  function handleGen() {
    if (onGenerateAll) {
      onGenerateAll();
      return;
    }
    toast.success("Generating Say This lines for every story…", {
      description: "In production this would re-run the LLM for the active persona.",
    });
  }

  return (
    <section
      className="relative overflow-hidden rounded-sm"
      style={{
        // 30vh on mobile, 42vh on desktop. Bumped the ceiling from 440
        // to 500 after the canonical BrandLockup landed at the top of
        // the slug area, the prior height was clipping the admin
        // button at the bottom on tall content. The first story still
        // sits above the fold on 1280x800.
        height: "clamp(320px, 42vh, 500px)",
      }}
    >
      {/* Photographic backdrop. Drifts slowly via .hero-cover-img. This is
          the LCP element on the Today landing page. */}
      <img
        src="/hero.jpg"
        alt=""
        aria-hidden="true"
        className="hero-cover-img absolute inset-0 w-full h-full object-cover"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
      <span className="hero-cover-shine absolute inset-0" aria-hidden="true" />

      {/* Composition veil: heavy at the bottom-left where the type sits,
          fading out top-right so the photographic detail breathes. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--grad-hero-overlay)" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 85% 18%, oklch(0.78 0.18 70 / 14%) 0%, transparent 55%)",
        }}
        aria-hidden="true"
      />
      <span className="absolute inset-0 noise-overlay" style={{ opacity: 0.4 }} aria-hidden="true" />
      <div
        className="absolute inset-0 rounded-sm pointer-events-none"
        style={{
          boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 6%)",
        }}
        aria-hidden="true"
      />

      <div className="relative h-full flex flex-col p-6 sm:p-8 lg:p-10">
        {/* Top slug, canonical brand lockup on the left, date + edition
            stacked tight on the right. The lockup is required on hero
            sections per brand guide §2.1; the prior layout split date
            onto its own row, costing ~30px of vertical that the bottom
            stack needs. */}
        <div className="flex items-start justify-between gap-4 flex-wrap text-[var(--color-fg-subtle)]">
          <BrandLockup size={32} byline />
          <div className="flex flex-col items-end gap-1.5 leading-none">
            {edition && (
              <span className="overline" style={{ letterSpacing: "0.2em" }}>
                Edition No. {edition.number} · 07:00 AEST
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="live-dot" aria-hidden="true" />
              <span className="overline" style={{ letterSpacing: "0.2em" }}>
                {todayLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom-anchored editorial stack. */}
        <div className="mt-auto max-w-[58ch]">
          <p
            className="overline-amber mb-3"
            style={{ letterSpacing: "0.26em", fontSize: "10px" }}
          >
            Property partner intelligence · 7AM AEST daily
          </p>
          <h1
            className="font-serif font-bold tracking-tight"
            style={{
              // Tighter floor (32px from 40px) so the headline never
              // pushes 'Desk.' off the bottom of the hero card on
              // iPhone-SE-width viewports (375px). The clamp ceiling
              // unchanged so the desktop treatment keeps its weight.
              fontSize: "clamp(32px, 5vw, 72px)",
              lineHeight: "0.94",
            }}
          >
            <span className="block first-paint-mark text-[var(--color-fg)]">Today's</span>
            <span
              className="block first-paint-content"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.96 0.08 88) 0%, oklch(0.82 0.20 76) 55%, oklch(0.65 0.16 60) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Desk.
            </span>
          </h1>

          <div className="flex items-end justify-between gap-6 mt-4 flex-wrap">
            <p className="font-serif text-base sm:text-lg text-[var(--color-fg-muted)] max-w-[44ch] leading-snug">
              A sixty-second scan of what's moving Australian property.
              Written for brokers, advisers, accountants and buyer's agents.
            </p>
            {isAdmin && (
              <button
                onClick={handleGen}
                title="Regenerate the four persona angles ('Say This') for every story in today's feed"
                className="group inline-flex items-center gap-2.5 rounded px-5 py-2.5 text-xs font-mono uppercase tracking-[0.2em] transition-all active:scale-[0.98] shrink-0 text-[var(--color-on-amber)]"
                style={{
                  background: "var(--grad-cta-amber)",
                  boxShadow:
                    "0 1px 0 oklch(1 0 0 / 18%) inset, 0 10px 24px var(--color-amber-glow)",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Gen all Say This
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

