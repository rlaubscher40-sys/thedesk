import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { sourceTimingLabel } from "@shared/sourceTiming";

function stamp(value: Date | string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })
    : "not recorded";
}

/** Read-only inspection of exact confirmed receipts, never a publishing control. */
export function PublicationAudit() {
  const [open, setOpen] = useState(false);
  const query = trpc.instagram.publicationAudit.useQuery(undefined, { enabled: open });
  return (
    <details
      className="rounded border border-[var(--color-border)] p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Trace confirmed carousels to their stories
      </summary>
      {open && (
        <div className="mt-3 space-y-4 text-xs">
          <p className="text-[var(--color-fg-muted)]">
            Saved media confirmations and exact story IDs. Enrichment status is read now; source
            information captured at publication is shown separately from later edits. Publisher
            dates remain claims.
          </p>
          {query.isLoading ? (
            <p>Reading publication receipts…</p>
          ) : query.isError ? (
            <p role="alert">Publication records could not be read. Their status is unknown.</p>
          ) : !query.data?.length ? (
            <p>
              No confirmed carousel receipts with story IDs were found. Older posts cannot be
              reconstructed from today’s rankings.
            </p>
          ) : (
            query.data.map((post) => (
              <article
                key={post.mediaId}
                className="border-t border-[var(--color-border)] pt-3 space-y-2"
              >
                <p className="font-mono">Media {post.mediaId}</p>
                <p>Confirmed {stamp(post.confirmedAt)} Sydney</p>
                <ul className="space-y-3">
                  {post.stories.map((story) => {
                    const captured = story.capturedAtPublication;
                    const source = captured ?? story.currentRecord;
                    return (
                      <li key={story.id}>
                        <a className="underline" href={`/story/${story.id}`}>
                          Story #{story.id}
                        </a>
                        <p>
                          Enrichment: {story.enrichment.status}
                          {"reason" in story.enrichment && story.enrichment.reason
                            ? ` (${story.enrichment.reason})`
                            : ""}
                        </p>
                        <p className="text-[var(--color-fg-muted)]">
                          {captured
                            ? "Source snapshot captured at publication."
                            : "No source snapshot was captured for this older post. Current record shown; historical state is unconfirmed."}
                        </p>
                        {source ? (
                          <>
                            <p>
                              Feed date: {source.feedDate}. Imported: {stamp(source.importedAt)}{" "}
                              Sydney.
                            </p>
                            <p>{sourceTimingLabel(source.sourceTiming)}</p>
                          </>
                        ) : (
                          <p>Source record unavailable.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))
          )}
        </div>
      )}
    </details>
  );
}
