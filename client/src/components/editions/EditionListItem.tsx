/**
 * Row in the Editions list. Visually dense — thumbnail, edition number, the
 * week range, and a draft badge when the Substack draft has been saved
 * (improvement #8 in the brief). Active state uses an amber-tinted border
 * and inner glow.
 */
import { Clock, FileText } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/cn";

type Props = {
  editionNumber: number;
  weekRange: string;
  publishedAt: Date | string | null;
  readingTime: string | null;
  heroImageUrl: string | null;
  hasDraft: boolean;
  active?: boolean;
};

export function EditionListItem({
  editionNumber,
  weekRange,
  publishedAt,
  readingTime,
  heroImageUrl,
  hasDraft,
  active,
}: Props) {
  return (
    <Link
      href={`/editions/${editionNumber}`}
      className={cn(
        "block p-4 panel rounded transition-all relative",
        active
          ? "border-amber-400/40 bg-amber-500/[0.04] shadow-[0_0_24px_oklch(0.75_0.18_70/8%)]"
          : "panel-hover"
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r"
          style={{ background: "var(--color-amber)" }}
          aria-hidden="true"
        />
      )}
      <div className="flex gap-3">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt=""
            loading="lazy"
            className="h-16 w-16 rounded object-cover bg-black/30 shrink-0"
          />
        ) : (
          <div
            className="h-16 w-16 rounded shrink-0 relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-deep) 60%, var(--color-amber-dim))",
            }}
            aria-hidden="true"
          >
            <span
              className="absolute inset-0 opacity-30"
              style={{
                background:
                  "radial-gradient(circle at 70% 25%, oklch(0.75 0.18 70 / 50%), transparent 60%)",
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p
              className={cn(
                "overline transition-colors",
                active ? "text-amber-300" : ""
              )}
            >
              Edition {editionNumber}
            </p>
            {hasDraft && <DraftBadge />}
          </div>
          <p
            className={cn(
              "font-serif text-sm leading-snug line-clamp-2",
              active ? "text-[var(--color-fg)]" : "text-[var(--color-fg)]"
            )}
          >
            {weekRange}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {publishedAt && (
              <p className="overline">{new Date(publishedAt).toLocaleDateString("en-AU")}</p>
            )}
            {readingTime && (
              <p className="overline flex items-center gap-1">
                <Clock className="h-3 w-3" /> {readingTime}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Improvement #8 — small amber pill on edition list items that have a saved
 * Substack draft.
 */
function DraftBadge() {
  return (
    <span
      title="Substack draft saved"
      className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
    >
      <FileText className="h-2.5 w-2.5" />
      Draft
    </span>
  );
}
