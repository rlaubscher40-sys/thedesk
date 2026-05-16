/**
 * Hero block at the top of an EditionReader. Editorial broadsheet layout —
 * the hero image is wide-format, the title is in display-1 serif, and
 * Ruben's Take gets a quoted block with an oversized opening quotation
 * mark so it reads like the lead of a print essay.
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Edition } from "@shared/types";
import type { KeyMetrics } from "@shared/schemas";
import { AuthorByline } from "@/components/desk/AuthorByline";
import { resolveMetricTrend } from "@/lib/metrics";
import { ShareEditionButton } from "./ShareEditionButton";

export function EditionHero({
  edition,
  priorMetrics,
}: {
  edition: Edition;
  /** Prior edition's keyMetrics so the strip can render trend arrows. */
  priorMetrics?: KeyMetrics | null;
}) {
  // Folio = the printed-page corner marker. Carries the edition number,
  // weekday and city. Decorative on screen, ritual in print.
  const folio = `EDITION No. ${edition.editionNumber} · WEEK OF ${edition.weekOf} · SYDNEY`;
  return (
    <header className="mb-12 relative">
      {/* Top folio — printed broadsheet header. Sits above the hero with
          a hairline rule above and below, mono uppercase, character-
          spaced. */}
      <div className="mb-8">
        <div className="h-px bg-[var(--color-border-strong)]" aria-hidden="true" />
        <div className="flex items-center justify-between gap-4 flex-wrap py-2.5">
          <p
            className="font-mono uppercase text-[var(--color-fg-subtle)] truncate"
            style={{ fontSize: "10px", letterSpacing: "0.24em" }}
          >
            {folio}
          </p>
          <div className="flex items-center gap-4">
            {edition.marketStress && <MarketStressBadge level={edition.marketStress} />}
            <p
              className="font-mono uppercase text-[var(--color-fg-subtle)]"
              style={{ fontSize: "10px", letterSpacing: "0.24em" }}
            >
              The Desk · Daily Intelligence
            </p>
          </div>
        </div>
        <div className="h-px bg-[var(--color-border-strong)]" aria-hidden="true" />
        <div className="h-px mt-px bg-[var(--color-border)]" aria-hidden="true" />
      </div>

      {/* Wide-format hero image. Capped at 420px so the cover doesn't
          dwarf the rest of the page on tall monitors. Aspect ratio
          tightened from 2:1 to 16:5 (≈3.2:1) — short cinematic band. */}
      {edition.heroImageUrl ? (
        <div
          className="aspect-[16/5] w-full overflow-hidden rounded-sm mb-8 bg-[var(--color-bg-elevated)] relative"
          style={{ maxHeight: 420 }}
        >
          {/* Ken Burns drift — slow scale + translate3d so the cover
              feels alive without competing with the content. This is the
              page's LCP element so it MUST NOT be lazy-loaded; fetchpriority
              tells the browser to fetch it ahead of the JS bundles. */}
          <img
            src={edition.heroImageUrl}
            alt={`Cover for Edition ${edition.editionNumber}`}
            className="hero-cover-img w-full h-full object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          {/* Specular highlight sweeps slowly across the surface. */}
          <span className="hero-cover-shine" aria-hidden="true" />
          {/* Top vignette + bottom-fade gradient so the title underneath
              has weight and the cover has depth. */}
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.11 0.018 260 / 60%), transparent)",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, transparent, oklch(0.11 0.018 260 / 75%))",
            }}
            aria-hidden="true"
          />
          {/* Edge inner ring — extra gloss. */}
          <div
            className="absolute inset-0 pointer-events-none rounded"
            style={{
              boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 14%), inset 0 0 80px oklch(0 0 0 / 35%)",
            }}
            aria-hidden="true"
          />
        </div>
      ) : (
        <HeroPlaceholder />
      )}

      {/* Editorial slug — edition number + reading time on the left,
          Share button on the right. */}
      <div className="flex items-center justify-between gap-4 mt-8 mb-5 flex-wrap">
        <div className="flex items-baseline gap-4">
          <p
            className="overline-amber"
            style={{ letterSpacing: "0.24em", fontSize: "11px" }}
          >
            Edition No. {edition.editionNumber}
          </p>
          {edition.readingTime && (
            <>
              <span
                className="block h-px w-8"
                style={{ background: "var(--color-border-strong)" }}
                aria-hidden="true"
              />
              <p className="overline text-[var(--color-fg-subtle)]">
                {edition.readingTime} read
              </p>
            </>
          )}
        </div>
        <ShareEditionButton edition={edition} />
      </div>

      {/* Hero title — tighter clamp than display-1 so it doesn't dwarf
          the rest of the page. The italic tagline finishes the sentence. */}
      <h1
        className="font-serif font-bold tracking-tight"
        style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: "0.98" }}
      >
        {edition.weekRange}
      </h1>

      <p
        className="font-serif italic text-[var(--color-fg-muted)] leading-snug max-w-[60ch] mt-5"
        style={{ fontSize: "clamp(1.05rem, 1.3vw, 1.3rem)" }}
      >
        Weekly intelligence for property partnerships.
      </p>

      {/* Ruben's Take — the editorial hook. The quote and the print-
          style byline share one column with the same amber rule down
          the left edge, so the byline reads as the end of the take
          rather than a floating sidebar. */}
      {edition.rubensTake && (
        <div className="mt-12 mb-12 relative pl-7 max-w-[80ch]">
          <span
            className="absolute left-0 top-1 bottom-1 w-px"
            style={{
              background:
                "linear-gradient(180deg, var(--color-amber) 0%, transparent 100%)",
            }}
            aria-hidden="true"
          />
          <p
            className="overline mb-3"
            style={{ color: "var(--color-amber)", letterSpacing: "0.24em" }}
          >
            Ruben's Take
          </p>
          <blockquote
            className="font-serif italic text-[var(--color-fg)] leading-snug"
            style={{ fontSize: "clamp(1.25rem, 2.2vw, 1.75rem)" }}
          >
            {edition.rubensTake}
          </blockquote>
          <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
            <AuthorByline />
          </div>
        </div>
      )}

      {/* Metric strip — dense, mono, tabular. */}
      {edition.keyMetrics && Object.keys(edition.keyMetrics).length > 0 && (
        <MetricsStrip metrics={edition.keyMetrics} prior={priorMetrics ?? null} />
      )}
    </header>
  );
}

function HeroPlaceholder() {
  return (
    <div
      className="aspect-[16/5] w-full rounded-sm mb-8 relative overflow-hidden noise-overlay"
      style={{
        maxHeight: 420,
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

function MetricsStrip({
  metrics,
  prior,
}: {
  metrics: KeyMetrics;
  prior: KeyMetrics | null;
}) {
  const entries = Object.entries(metrics).slice(0, 6);
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px panel rounded-sm overflow-hidden"
      role="list"
      aria-label="Key market metrics versus prior edition"
    >
      {entries.map(([label, value], idx) => (
        <MetricTile
          key={`${label}-${idx}`}
          label={label}
          value={value}
          prior={prior?.[label]}
        />
      ))}
    </div>
  );
}

function MetricTile({
  label,
  value,
  prior,
}: {
  label: string;
  value: string | number;
  prior: string | number | undefined | null;
}) {
  const { hasDelta, delta, trend, sentiment, colour } = resolveMetricTrend(
    label,
    value,
    prior
  );
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;

  return (
    <div
      role="listitem"
      className="bg-[var(--color-bg-elevated)] p-4 hover:bg-[oklch(0.18_0.02_260)] transition-colors"
    >
      <p
        className="overline mb-2 truncate text-[var(--color-fg-subtle)]"
        style={{ letterSpacing: "0.18em" }}
        title={label}
      >
        {label}
      </p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-lg font-semibold tabular-nums text-[var(--color-fg)] leading-none">
          {value}
        </p>
        <span
          className="inline-flex items-center gap-1 font-mono tabular-nums"
          style={{ color: colour, fontSize: "11px" }}
          title={`${trend} vs prior · ${sentiment}`}
          aria-label={`${trend} versus prior — ${sentiment}`}
        >
          <Icon className="h-3 w-3" strokeWidth={2.5} />
          {hasDelta && trend !== "flat" && (
            <span>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(Math.abs(delta) < 1 ? 3 : 2)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function MarketStressBadge({ level }: { level: string }) {
  const colour =
    level === "high"
      ? "oklch(0.68 0.20 15)"
      : level === "moderate"
        ? "oklch(0.78 0.18 70)"
        : "oklch(0.72 0.17 155)";
  const label =
    level === "high"
      ? "HIGH MARKET STRESS"
      : level === "moderate"
        ? "MODERATE STRESS"
        : "LOW STRESS";
  return (
    <span
      className="inline-flex items-center gap-2 font-mono uppercase"
      style={{ fontSize: "10px", letterSpacing: "0.22em", color: colour }}
      title={`Market stress: ${level}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: colour, boxShadow: `0 0 8px ${colour}` }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
