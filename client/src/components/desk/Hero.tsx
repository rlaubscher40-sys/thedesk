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
      className="relative overflow-hidden rounded panel"
      style={{ aspectRatio: "21 / 9", minHeight: 420 }}
    >
      {/* Photographic backdrop. */}
      <img
        src="/hero.svg"
        alt=""
        aria-hidden="true"
        className="hero-cover-img absolute inset-0 w-full h-full object-cover"
      />
      {/* Specular sheen. */}
      <span className="hero-cover-shine absolute inset-0" aria-hidden="true" />
      {/* Dark legibility veil. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, oklch(0.08 0.018 260 / 88%) 0%, oklch(0.08 0.018 260 / 55%) 50%, oklch(0.08 0.018 260 / 30%) 100%)",
        }}
        aria-hidden="true"
      />
      {/* Noise overlay. */}
      <span className="absolute inset-0 noise-overlay" style={{ opacity: 0.4 }} aria-hidden="true" />
      {/* Inner amber ring. */}
      <div
        className="absolute inset-0 rounded pointer-events-none"
        style={{
          boxShadow:
            "inset 0 0 0 1px oklch(0.75 0.18 70 / 16%), inset 0 0 80px oklch(0 0 0 / 30%)",
        }}
        aria-hidden="true"
      />

      <div className="relative h-full flex flex-col justify-between p-8 sm:p-10 lg:p-14">
        {/* Top pills row. */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Pill>
              <span className="live-dot" aria-hidden="true" />
              <span className="ml-1.5">LIVE FEED</span>
            </Pill>
            <Pill>{editionMeta.longDate}</Pill>
          </div>
          <Pill>{editionMeta.publishedAt} DAILY</Pill>
        </div>

        {/* Middle stack: eyebrow + display + dek. */}
        <div className="max-w-3xl">
          <p
            className="overline-amber mb-5"
            style={{ letterSpacing: "0.22em", fontSize: "11px" }}
          >
            THE DESK <span className="text-[var(--color-fg-subtle)] mx-2">/</span> DAILY INTELLIGENCE BRIEF
          </p>
          <h1
            className="font-serif font-bold leading-[0.95] tracking-tight"
            style={{ fontSize: "clamp(56px, 9vw, 132px)" }}
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
          <p className="font-serif italic text-lg sm:text-xl text-[var(--color-fg-muted)] mt-6 max-w-2xl leading-snug">
            What's cutting through right now. 60-second scan, updated every morning.
          </p>
          <p
            className="overline mt-5"
            style={{ letterSpacing: "0.2em", fontSize: "10px" }}
          >
            BY RUBEN LAUBSCHER
          </p>
        </div>

        {/* Primary CTA. */}
        <div className="flex items-end justify-between gap-4">
          <button
            onClick={handleGen}
            className="group inline-flex items-center gap-2.5 rounded px-5 py-3 text-sm font-mono uppercase tracking-[0.16em] transition-all active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 50%, oklch(0.68 0.16 60) 100%)",
              color: "oklch(0.10 0.018 260)",
              boxShadow:
                "0 0 0 1px oklch(0.95 0.10 80 / 30%), 0 8px 24px oklch(0.75 0.18 70 / 35%)",
            }}
          >
            <Sparkles className="h-4 w-4" />
            Gen all Say This
          </button>
          <p
            className="overline text-[var(--color-fg-subtle)] hidden sm:block"
            style={{ fontSize: "10px" }}
          >
            EDITION No. {editionMeta.number}
          </p>
        </div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center font-mono uppercase tracking-[0.18em] px-2.5 py-1 rounded border"
      style={{
        fontSize: "10px",
        color: "oklch(0.85 0.16 75 / 90%)",
        borderColor: "oklch(0.85 0.16 75 / 22%)",
        background: "oklch(0.11 0.018 260 / 55%)",
        backdropFilter: "blur(8px)",
      }}
    >
      {children}
    </span>
  );
}
