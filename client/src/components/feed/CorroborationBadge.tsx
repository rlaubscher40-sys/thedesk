/**
 * Small "N outlets" badge shown in a story card's metadata bar when more
 * than one source reported the same story (from the ingest clustering pass).
 * Lets a reader weight a corroborated event over a single-source rumour at a
 * glance. Renders nothing for single-source stories.
 */
import { Layers } from "lucide-react";

export function CorroborationBadge({
  count,
  sources,
}: {
  count: number | null | undefined;
  sources: string[] | null | undefined;
}) {
  if (!count || count < 2) return null;
  const title = sources && sources.length > 0
    ? `Reported by ${sources.join(", ")}`
    : `${count} outlets reporting`;
  return (
    <span
      className="inline-flex items-center gap-1 overline shrink-0 text-[var(--color-fg-subtle)]"
      style={{ letterSpacing: "0.16em" }}
      title={title}
      aria-label={title}
    >
      <Layers className="h-3 w-3" aria-hidden="true" />
      {count} outlets
    </span>
  );
}
