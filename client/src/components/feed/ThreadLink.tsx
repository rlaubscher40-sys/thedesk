/**
 * "Continues from …" link shown on a story that threads to recent prior
 * coverage (set at ingest by headline similarity). Gives a reader the
 * storyline spine instead of isolated cards. Renders nothing when the story
 * has no parent.
 */
import { Link } from "wouter";
import { CornerDownRight } from "lucide-react";

export function ThreadLink({
  parentId,
  parentTitle,
}: {
  parentId: number | null | undefined;
  parentTitle: string | null | undefined;
}) {
  if (!parentId || !parentTitle) return null;
  return (
    <Link
      href={`/story/${parentId}`}
      className="group inline-flex items-center gap-1.5 text-[var(--color-fg-subtle)] hover:text-amber-200 transition-colors max-w-full"
      title={`Continues from: ${parentTitle}`}
    >
      <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span
        className="overline shrink-0"
        style={{ letterSpacing: "0.16em" }}
      >
        Continues from
      </span>
      <span className="text-xs truncate group-hover:underline underline-offset-2 min-w-0">
        {parentTitle}
      </span>
    </Link>
  );
}
