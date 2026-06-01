/**
 * Hero block at the top of an EditionReader. Editorial broadsheet layout —
 * the hero image is wide-format, the title is in display-1 serif, and
 * Ruben's Take gets a quoted block with an oversized opening quotation
 * mark so it reads like the lead of a print essay.
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Edition } from "@shared/types";
import { signalText, type KeyMetrics, type Signals } from "@shared/schemas";
import { AuthorByline } from "@/components/desk/AuthorByline";
import { BrandLockup } from "@/components/Logomark";
import { resolveMetricTrend } from "@/lib/metrics";
import { ShareEditionButton } from "./ShareEditionButton";

export function EditionHero({
  edition,
  priorMetrics,
  priorMarketStress,
}: {
  edition: Edition;
  /** Prior edition's keyMetrics so the strip can render trend arrows. */
  priorMetrics?: KeyMetrics | null;
  /** Prior edition's marketStress so the badge can show the direction of
   *  travel (stress rising / easing) rather than just the level. */
  priorMarketStress?: string | null;
}) {
  // Folio = the printed-page corner marker. Carries the edition number,
  // weekday and city. Decorative on screen, ritual in print.
  const folio = `EDITION No. ${edition.editionNumber} · WEEK OF ${edition.weekOf} · SYDNEY`;
  return (
    <header className="mb-12 relative">
      {/* Top folio, printed broadsheet header. Sits above the hero with
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
            {edition.marketStress && (
              <MarketStressBadge
                level={edition.marketStress}
                prior={priorMarketStress ?? null}
              />
            )}
            <BrandLockup size={22} byline={false} />
          </div>
        </div>
        <div className="h-px bg-[var(--color-border-strong)]" aria-hidden="true" />
        <div className="h-px mt-px bg-[var(--color-border)]" aria-hidden="true" />
      </div>

      {/* Wide-format hero image. Capped at 420px so the cover doesn't
          dwarf the rest of the page on tall monitors. Aspect ratio
          tightened from 2:1 to 16:5 (≈3.2:1), short cinematic band. */}
      {edition.heroImageUrl ? (
        <div
          className="aspect-[16/5] w-full overflow-hidden rounded-sm mb-8 bg-[var(--color-bg-elevated)] relative"
          style={{ maxHeight: 420 }}
        >
          {/* Ken Burns drift, slow scale + translate3d so the cover
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
            style={{ background: "var(--grad-hero-fade-top)" }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
            style={{ background: "var(--grad-hero-fade-bottom)" }}
            aria-hidden="true"
          />
          {/* Edge inner ring, extra gloss. */}
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

      {/* Editorial slug, edition number + reading time on the left,
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

      {/* Hero title, tighter clamp than display-1 so it doesn't dwarf
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

      {/* Ruben's Take + In-brief scan strip, two-column on desktop so the
          take doesn't sit lonely on the left half of a wide canvas. The
          scan strip carries the first 6 signals as quick hits the reader
          can absorb before diving in. Single column on mobile, take first
          then scan. */}
      {(edition.rubensTake || (edition.signals && edition.signals.length > 0)) && (
        <div className="mt-12 mb-12 grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
          {edition.rubensTake && (
            <div className="relative pl-7">
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
          {edition.signals && edition.signals.length > 0 && (
            <InBriefScan signals={edition.signals} />
          )}
        </div>
      )}

      {/* Metric strip, dense, mono, tabular. */}
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
        background: "var(--grad-hero-placeholder)",
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
      className="bg-[var(--color-bg-elevated)] p-4 hover:bg-[var(--color-bg-deep)] transition-colors"
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
          aria-label={`${trend} versus prior, ${sentiment}`}
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

const STRESS_RANK: Record<string, number> = { low: 0, moderate: 1, high: 2 };

function MarketStressBadge({
  level,
  prior,
}: {
  level: string;
  prior?: string | null;
}) {
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

  // Direction of travel vs the prior edition. Rising stress is the signal
  // that matters most, so it gets the level's own (hotter) colour; easing
  // reads calm-green, steady stays muted.
  const cur = STRESS_RANK[level];
  const prev = prior != null ? STRESS_RANK[prior] : undefined;
  let trend: "rising" | "easing" | "steady" | null = null;
  if (cur != null && prev != null) {
    trend = cur > prev ? "rising" : cur < prev ? "easing" : "steady";
  }
  const TrendIcon =
    trend === "rising" ? ArrowUp : trend === "easing" ? ArrowDown : Minus;
  const trendColour =
    trend === "rising"
      ? colour
      : trend === "easing"
        ? "oklch(0.72 0.17 155)"
        : "var(--color-fg-subtle)";

  return (
    <span
      className="inline-flex items-center gap-2 font-mono uppercase"
      style={{ fontSize: "10px", letterSpacing: "0.22em", color: colour }}
      title={
        trend
          ? `Market stress: ${level} (${trend} vs last edition)`
          : `Market stress: ${level}`
      }
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: colour, boxShadow: `0 0 8px ${colour}` }}
        aria-hidden="true"
      />
      {label}
      {trend && (
        <span
          className="inline-flex items-center gap-0.5"
          style={{ color: trendColour }}
          aria-label={`${trend} versus last edition`}
        >
          <TrendIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
          {trend}
        </span>
      )}
    </span>
  );
}

/**
 * "In brief" scan strip, the first six edition signals as dot-point hits,
 * sized so a reader can absorb the whole week at a glance before diving
 * into the topic deck. Rendered next to Ruben's Take on desktop; stacks
 * underneath on mobile.
 */
function InBriefScan({ signals }: { signals: Signals }) {
  const filtered = signals
    .map((s) => signalText(s))
    .filter((s) => s && s.trim().length > 0)
    .slice(0, 6);
  if (filtered.length === 0) return null;
  return (
    <aside
      className="panel rounded-sm p-5 lg:p-6"
      aria-label="In brief"
      style={{
        background: "var(--grad-panel-soft)",
        boxShadow: "inset 0 0 0 1px var(--color-amber-dim)",
      }}
    >
      <p
        className="overline-amber mb-4"
        style={{ letterSpacing: "0.22em", fontSize: "10px" }}
      >
        In brief
      </p>
      <ol className="space-y-3">
        {filtered.map((s, i) => (
          <li
            key={`brief-${i}-${s.slice(0, 24)}`}
            className="grid grid-cols-[22px_minmax(0,1fr)] items-baseline gap-2"
          >
            <span
              className="font-mono tabular-nums text-amber-400/80"
              style={{ fontSize: "11px" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className="text-[var(--color-fg)] leading-snug"
              style={{ fontSize: "13.5px" }}
            >
              {s}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
