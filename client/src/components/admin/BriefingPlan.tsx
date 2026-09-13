import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function BriefingPlan() {
  const [open, setOpen] = useState(false);
  const query = trpc.instagram.briefingPlan.useQuery(undefined, { enabled: open });
  return (
    <details
      className="rounded border border-[var(--color-border)] p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium">Why these briefing stories?</summary>
      {open && (
        <div className="mt-3 space-y-3 text-xs">
          <p>
            Current Sydney feed only. Reported data and news rank ahead of proposals, forecasts and
            commentary. These labels describe the copy, not its truth. Selection can change before
            publication.
          </p>
          {query.isLoading ? (
            <p>Reading candidate stories…</p>
          ) : query.isError ? (
            <p role="alert">Selection could not be read. Its status is unknown.</p>
          ) : (
            <>
              <p>
                {query.data?.date}: {query.data?.selectedIds.length ?? 0} unpublished candidates
                selected. Normal briefings run weekdays at 7:30 am Sydney.
              </p>
              {!query.data?.stories.length && (
                <p>No stories in this date’s feed yet. An earlier feed is not substituted.</p>
              )}
              {query.data?.stories.map((story) => (
                <article key={story.id} className="border-t border-[var(--color-border)] pt-2">
                  <a href={`/story/${story.id}`} className="underline">
                    {story.title}
                  </a>
                  <p>
                    {story.source} · {story.kind}
                  </p>
                  <p>
                    {story.hold ??
                      (query.data.selectedIds.includes(story.id)
                        ? "Selected"
                        : "Eligible copy; already used/reserved or ranked below the selection")}
                  </p>
                </article>
              ))}
            </>
          )}
        </div>
      )}
    </details>
  );
}
