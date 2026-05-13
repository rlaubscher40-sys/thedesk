/**
 * Hero block at the top of an EditionReader. Shows the hero image (or a
 * gradient placeholder), title, Ruben's Take, and the keyMetrics strip.
 */
import type { Edition } from "@shared/types";
import type { KeyMetrics } from "@shared/schemas";

export function EditionHero({ edition }: { edition: Edition }) {
  return (
    <header className="mb-10">
      {edition.heroImageUrl ? (
        <div className="aspect-[3/1] w-full overflow-hidden rounded mb-6 bg-[var(--color-bg-elevated)]">
          <img
            src={edition.heroImageUrl}
            alt={`Cover for Edition ${edition.editionNumber}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="aspect-[3/1] w-full rounded mb-6"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.18 0.018 260), oklch(0.12 0.018 260) 60%, oklch(0.3 0.18 70 / 18%))",
          }}
          aria-hidden="true"
        />
      )}

      <p className="overline mb-2">
        Edition {edition.editionNumber} · {edition.weekRange}
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl leading-tight mb-4 max-w-3xl">
        Weekly intelligence · {edition.weekRange}
      </h1>

      {edition.rubensTake && (
        <blockquote className="border-l-2 border-amber-400 pl-4 my-6 max-w-3xl">
          <p className="overline mb-2">Ruben's Take</p>
          <p className="font-serif italic text-lg leading-relaxed text-[var(--color-fg)]">
            {edition.rubensTake}
          </p>
        </blockquote>
      )}

      {edition.keyMetrics && Object.keys(edition.keyMetrics).length > 0 && (
        <MetricsStrip metrics={edition.keyMetrics} />
      )}
    </header>
  );
}

function MetricsStrip({ metrics }: { metrics: KeyMetrics }) {
  const entries = Object.entries(metrics).slice(0, 6);
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px panel rounded overflow-hidden mt-6"
      role="list"
    >
      {entries.map(([label, value], idx) => (
        // Defensive key: use label when unique, fall back to index — issue #1.
        <div
          key={`${label}-${idx}`}
          role="listitem"
          className="bg-[var(--color-bg-elevated)] p-4"
        >
          <p className="overline mb-1.5 truncate">{label}</p>
          <p className="font-mono text-base font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
