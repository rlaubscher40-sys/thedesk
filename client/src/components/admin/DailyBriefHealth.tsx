import { trpc } from "@/lib/trpc";
export function DailyBriefHealth() {
  const query = trpc.health.dailyBriefDelivery.useQuery(undefined, { refetchInterval: 60_000 });
  return (
    <section className="border border-[var(--color-rule)] rounded-lg p-4">
      <h3 className="font-semibold">Daily brief delivery</h3>
      <p className="mt-2 text-sm">
        Weekdays, 7am–noon Sydney time. Delivery waits for the selected stories to finish
        processing. Three attempts per subscriber; older briefs are never sent automatically.
      </p>
      {query.isLoading ? (
        <p className="mt-2 text-sm">Loading delivery status…</p>
      ) : query.isError ? (
        <p className="mt-2 text-sm">Delivery status is unavailable.</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            {query.data?.date} ·{" "}
            {query.data?.prepared
              ? "Story selection saved"
              : "No story selection saved yet"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {Object.entries({
              pending: "Waiting or retrying",
              running: "Sending or awaiting recovery",
              accepted: "Accepted by email provider",
              failed: "Needs review",
              skipped: "Skipped after subscriber change",
              expired: "Morning window missed",
            }).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd className="font-semibold">{query.data?.counts[key] ?? 0}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm">Provider acceptance is not confirmation of inbox delivery.</p>
          {Boolean(query.data?.recentIssues.length) && (
            <p className="mt-2 text-sm">
              Recent delivery issues:{" "}
              {query.data?.recentIssues
                .map(
                  (issue) => `${issue.feedDate}, subscriber #${issue.subscriberId}: ${issue.status}`
                )
                .join("; ")}
              .
            </p>
          )}
        </>
      )}
    </section>
  );
}
