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
 * Backed by /public/hero.svg with a gradient veil + film-grain overlay.
 */
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { editionMeta } from "@/data/editions/2026-05-15";

export function Hero({ onGenerateAll }: { onGenerateAll?: () => void }) {
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
      style={{ aspectRatio: "21 / 9", minHeight: 460 }}
    >
      {/* Photographic backdrop. Drifts slowly via .hero-cover-img. */}
      <img
        src="/hero.svg"
        alt=""
        aria-hidden="true"
        className="hero-cover-img absolute inset-0 w-full h-full object-cover"
      />
      <span className="hero-cover-shine absolute inset-0" aria-hidden="true" />

      {/* Composition veil: heavy at the bottom-left where the type sits,
          fading out top-right so the photographic detail breathes. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, oklch(0.07 0.018 260 / 94%) 0%, oklch(0.07 0.018 260 / 70%) 35%, oklch(0.07 0.018 260 / 30%) 65%, transparent 100%)",
        }}
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

      <div className="relative h-full flex flex-col p-8 sm:p-12 lg:p-16 xl:p-20">
        {/* Quiet top slug — just date + edition. */}
        <div className="flex items-center justify-between gap-4 flex-wrap text-[var(--color-fg-subtle)]">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="live-dot" aria-hidden="true" />
            <span className="overline" style={{ letterSpacing: "0.2em" }}>
              {editionMeta.longDate}
            </span>
          </div>
          <span className="overline" style={{ letterSpacing: "0.2em" }}>
            Edition No. {editionMeta.number} · {editionMeta.publishedAt}
          </span>
        </div>

        {/* Bottom-anchored editorial stack. */}
        <div className="mt-auto max-w-[58ch]">
          <p
            className="overline-amber mb-6"
            style={{ letterSpacing: "0.26em", fontSize: "10px" }}
          >
            Daily Intelligence Brief
          </p>
          <h1
            className="font-serif font-bold tracking-tight"
            style={{ fontSize: "clamp(64px, 10vw, 156px)", lineHeight: "0.92" }}
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

          <div className="flex items-end justify-between gap-6 mt-8 flex-wrap">
            <p className="font-serif italic text-lg sm:text-xl text-[var(--color-fg-muted)] max-w-[42ch] leading-snug">
              What's cutting through right now. A sixty-second scan, updated each morning before the open.
            </p>
            <button
              onClick={handleGen}
              className="group inline-flex items-center gap-2.5 rounded px-5 py-2.5 text-xs font-mono uppercase tracking-[0.2em] transition-all active:scale-[0.98] shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 60%, oklch(0.65 0.16 60) 100%)",
                color: "oklch(0.10 0.018 260)",
                boxShadow:
                  "0 1px 0 oklch(1 0 0 / 18%) inset, 0 10px 24px oklch(0.75 0.18 70 / 28%)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Gen all Say This
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

