import { trpc } from "@/lib/trpc";
export function SocialPerformance() {
  const query = trpc.analytics.social.useQuery({ hours: 24 * 28 }, { refetchInterval: 300_000 });
  return (
    <section className="rule-hair py-5 space-y-3" aria-label="Instagram website outcomes">
      <h3 className="font-serif text-2xl">From Instagram into The Desk · 28 days</h3>
      <p className="text-sm text-[var(--color-fg-muted)]">
        First-party session counts from Instagram arrivals. The bio is a shared destination, so bio
        traffic cannot be assigned to an individual post. No email, browsing query or persistent
        identity is joined to this report.
      </p>
      {query.isLoading ? (
        <p role="status">Loading website outcomes…</p>
      ) : query.isError || !query.data?.available ? (
        <p role="alert">Website outcome data is unavailable. This does not mean zero visits.</p>
      ) : !query.data.rows.length ? (
        <p>
          No tagged outcomes recorded yet. Collection starts with this release; earlier visits are
          not backfilled.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                {[
                  "Arrival topic",
                  "Landed",
                  "Opened a read",
                  "Opened sources",
                  "Shared on site",
                ].map((label) => (
                  <th key={label} className="py-3 pr-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.rows.map((row) => (
                <tr key={row.campaign} className="border-t border-[var(--color-border)]">
                  <th className="py-3 pr-4 font-normal">{row.campaign.replaceAll("_", " ")}</th>
                  {[row.landings, row.onward, row.sources, row.shares].map((n, index) => (
                    <td key={index} className="pr-4 tabular-nums">
                      {n.toLocaleString("en-AU")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[var(--color-fg-muted)]">
        Each column counts distinct sessions separately. These are not a joined conversion funnel:
        actions can follow a landing outside this window. Shared links, blocked analytics and new
        tabs limit attribution. Use confirmed subscriber acquisition in the subscriber panel
        separately; do not call a click a subscription.
      </p>
      <p className="text-sm">
        Review weekly: use comparable 24–48-hour Instagram readings, inspect saves and shares with
        their sample counts, then check these website actions. Test one hook or opening change at a
        time. Do not increase frequency from a tiny sample.
      </p>
    </section>
  );
}
