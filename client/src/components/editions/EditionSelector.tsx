/**
 * Horizontal edition picker. Replaces the old sticky-left-rail.
 *
 * Renders the editions as horizontally scrolling cards with the cover
 * thumbnail, edition number, week range, reading time, and a Substack-
 * draft pill when applicable. The active edition gets an amber glow
 * and a wider footprint so the eye reads which one is open.
 *
 * On narrow viewports the row is a horizontal scroll list; on wide
 * viewports the row fits 5-6 cards comfortably with overflow scroll.
 */
import { Clock, FileText } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/cn";

type Edition = {
  id: number;
  editionNumber: number;
  weekRange: string;
  publishedAt: Date | string | null;
  readingTime: string | null;
  heroImageUrl: string | null;
  hasDraft: boolean;
};

export function EditionSelector({
  editions,
  activeNumber,
}: {
  editions: Edition[];
  activeNumber: number | null;
}) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory"
      style={{ scrollbarWidth: "thin" }}
      role="tablist"
      aria-label="Editions"
    >
      {editions.map((ed) => (
        <EditionChip
          key={ed.id}
          edition={ed}
          active={ed.editionNumber === activeNumber}
        />
      ))}
    </div>
  );
}

function EditionChip({ edition, active }: { edition: Edition; active: boolean }) {
  return (
    <Link
      href={`/editions/${edition.editionNumber}`}
      role="tab"
      aria-selected={active}
      className={cn(
        "snap-start shrink-0 rounded-sm overflow-hidden transition-all duration-200",
        "panel hover-lift",
        active
          ? "border-amber-400/40"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
      )}
      style={{
        width: 240,
        boxShadow: active
          ? "0 0 0 1px oklch(0.75 0.18 70 / 50%), 0 8px 24px oklch(0.75 0.18 70 / 12%)"
          : undefined,
      }}
    >
      {/* Thumbnail strip — squat 16:5 so the row reads as a row of
          horizontal cards rather than a tile grid. */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "16 / 5" }}
      >
        {edition.heroImageUrl ? (
          <img
            src={edition.heroImageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.16 0.018 260), oklch(0.08 0.018 260) 60%, oklch(0.32 0.18 70 / 28%))",
            }}
          />
        )}
        {/* Bottom fade so the meta below it has weight. */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, oklch(0.11 0.018 260 / 80%))",
          }}
          aria-hidden="true"
        />
        {active && (
          <span
            className="absolute top-2 left-2 inline-flex items-center gap-1.5"
            aria-hidden="true"
          >
            <span className="live-dot" />
            <span
              className="font-mono uppercase tracking-[0.18em] text-amber-300"
              style={{ fontSize: "9px" }}
            >
              Reading
            </span>
          </span>
        )}
      </div>

      {/* Meta. */}
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className={cn(
              "overline",
              active
                ? "text-amber-300"
                : "text-[var(--color-fg-subtle)]"
            )}
            style={{ letterSpacing: "0.2em" }}
          >
            Edition {edition.editionNumber}
          </p>
          {edition.hasDraft && (
            <span
              title="Substack draft saved"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.14em]"
              style={{
                color: "oklch(0.88 0.19 82)",
                background: "oklch(0.75 0.18 70 / 12%)",
                boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 32%)",
              }}
            >
              <FileText className="h-2.5 w-2.5" />
              Draft
            </span>
          )}
        </div>
        <p className="font-serif text-sm leading-snug line-clamp-1">
          {edition.weekRange}
        </p>
        <div className="flex items-center gap-3 mt-2">
          {edition.publishedAt && (
            <p className="overline text-[var(--color-fg-subtle)]">
              {new Date(edition.publishedAt).toLocaleDateString("en-AU", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })}
            </p>
          )}
          {edition.readingTime && (
            <p className="overline text-[var(--color-fg-subtle)] flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {edition.readingTime}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
