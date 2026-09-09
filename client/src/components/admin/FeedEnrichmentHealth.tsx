import { trpc } from "@/lib/trpc";

export function FeedEnrichmentHealth() {
  const query = trpc.health.feedEnrichment.useQuery(undefined, { refetchInterval: 60_000 });
  const labels = {
    pending: "Waiting or retrying",
    running: "Processing or awaiting recovery",
    completed: "Completed",
    skipped: "Skipped after story change or deletion",
    failed: "Needs review",
  };
  return (
    <section className="border border-[var(--color-rule)] rounded-lg p-4">
      <h3 className="font-semibold">Story AI recovery</h3>
      <p className="mt-2 text-sm">
        New Australian and property stories resume after interruptions. Three attempts maximum;
        saved results, source text and manual edits are preserved. Earlier stories are not
        backfilled.
      </p>
      {query.isLoading ? (
        <p className="mt-2 text-sm">Loading recovery status…</p>
      ) : query.isError ? (
        <p className="mt-2 text-sm">Recovery status is unavailable.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd className="font-semibold">{query.data?.counts[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          {query.data?.recentFailures.length ? (
            <p className="mt-3 text-sm">
              Recent stories needing review:{" "}
              {query.data.recentFailures
                .map((job) => `#${job.feedItemId} (${job.attempts} attempts)`)
                .join(", ")}
              . Review these stories in the feed editor before regenerating any missing text.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
