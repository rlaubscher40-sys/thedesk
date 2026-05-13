/**
 * Row in the Editions list. Shows the draft badge (improvement #8) and a hero
 * thumbnail when present.
 */
import { Link } from "wouter";
import { Clock, FileText } from "lucide-react";

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
      className={`block p-4 panel panel-hover rounded transition-colors ${
        active ? "border-amber-500/40 bg-amber-500/5" : ""
      }`}
    >
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
            className="h-16 w-16 rounded shrink-0"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.2 0.02 260), oklch(0.12 0.02 260) 60%, oklch(0.3 0.18 70 / 18%))",
            }}
            aria-hidden="true"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="overline">Edition {editionNumber}</p>
            {hasDraft && <DraftBadge />}
          </div>
          <p className="text-sm font-medium leading-snug line-clamp-2">{weekRange}</p>
          <p className="overline mt-1.5 flex items-center gap-2 text-[var(--color-fg-subtle)]">
            {publishedAt && <span>{new Date(publishedAt).toLocaleDateString("en-AU")}</span>}
            {readingTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {readingTime}
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}

/**
 * Improvement #8 — small amber pill on edition list items that have a saved
 * Substack draft. Visible on hover-detail by way of the tooltip title.
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
