/**
 * Hero block at the top of an EditionReader. Editorial broadsheet layout —
 * the hero image is wide-format, the title is in display-1 serif, and
 * Ruben's Take gets a quoted block with an oversized opening quotation
 * mark so it reads like the lead of a print essay.
 */
import { Quote } from "lucide-react";
import type { Edition } from "@shared/types";
import type { KeyMetrics } from "@shared/schemas";

export function EditionHero({ edition }: { edition: Edition }) {
  return (
    <header className="mb-12">
      {/* Wide-format hero image. Falls back to a dramatic gradient when no
          AI-generated image is available. */}
      {edition.heroImageUrl ? (
        <div className="aspect-[2/1] w-full overflow-hidden rounded mb-8 bg-[var(--color-bg-elevated)] relative">
          <img
            src={edition.heroImageUrl}
            alt={`Cover for Edition ${edition.editionNumber}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Bottom-fade gradient so the title underneath has weight. */}
          <div
            className="absolute inset-x-0 bottom-0 h-32"
            style={{
              background:
                "linear-gradient(180deg, transparent, oklch(0.11 0.018 260 / 60%))",
            }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <HeroPlaceholder />
      )}

      {/* Editorial slug — edition number + reading time. */}
      <div className="flex items-center gap-4 mb-4">
        <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          Edition No. {edition.editionNumber}
        </p>
        {edition.readingTime && (
          <>
            <span
              className="block"
              style={{
                width: "20px",
                height: "1px",
                background: "oklch(0.75 0.18 70 / 40%)",
              }}
              aria-hidden="true"
            />
            <p className="overline">{edition.readingTime} read</p>
          </>
        )}
      </div>

      {/* Hero title — display-1, the week range itself is the headline. */}
      <h1 className="display-1 max-w-4xl mb-3">{edition.weekRange}</h1>

      {/* Tagline — italic serif, drives the editorial register. */}
      <p className="font-serif italic text-lg sm:text-xl text-[var(--color-fg-muted)] max-w-2xl leading-snug">
        Weekly intelligence for property partnerships.
      </p>

      {/* Ruben's Take — the editorial hook. Big serif italic with an
          oversized amber quote mark, sitting against an amber left rule. */}
      {edition.rubensTake && (
        <blockquote className="relative mt-10 mb-10 pl-8 max-w-3xl">
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{
              width: "2px",
              background:
                "linear-gradient(180deg, var(--color-amber) 0%, oklch(0.75 0.18 70 / 18%) 100%)",
            }}
            aria-hidden="true"
          />
          <Quote
            className="absolute -left-1 -top-3 h-7 w-7 text-amber-400/30"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="overline-amber mb-3 ml-1">Ruben's Take</p>
          <p
            className="font-serif italic text-[var(--color-fg)] leading-snug"
            style={{ fontSize: "clamp(1.25rem, 2.2vw, 1.65rem)" }}
          >
            {edition.rubensTake}
          </p>
        </blockquote>
      )}

      {/* Metric strip — dense, mono, tabular. */}
      {edition.keyMetrics && Object.keys(edition.keyMetrics).length > 0 && (
        <MetricsStrip metrics={edition.keyMetrics} />
      )}
    </header>
  );
}

function HeroPlaceholder() {
  return (
    <div
      className="aspect-[2/1] w-full rounded mb-8 relative overflow-hidden noise-overlay"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.14 0.02 260) 0%, oklch(0.10 0.02 260) 35%, oklch(0.18 0.03 260) 60%, oklch(0.32 0.18 70 / 30%) 100%)",
      }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 78% 22%, oklch(0.75 0.18 70 / 32%) 0%, transparent 55%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 12% 80%, oklch(0.55 0.18 270 / 24%) 0%, transparent 50%)",
        }}
      />
    </div>
  );
}

function MetricsStrip({ metrics }: { metrics: KeyMetrics }) {
  const entries = Object.entries(metrics).slice(0, 6);
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px panel rounded overflow-hidden"
      role="list"
      aria-label="Key market metrics"
    >
      {entries.map(([label, value], idx) => (
        // Defensive key: use label when unique, fall back to index — issue #1.
        <div
          key={`${label}-${idx}`}
          role="listitem"
          className="bg-[var(--color-bg-elevated)] p-4 hover:bg-[oklch(0.18_0.02_260)] transition-colors"
        >
          <p className="overline mb-2 truncate" style={{ letterSpacing: "0.14em" }}>
            {label}
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-[var(--color-fg)]">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
