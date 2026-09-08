import { trpc } from "@/lib/trpc";

export function MetricHealthPanel() {
  const query = trpc.health.metricCoverage.useQuery(undefined, { refetchInterval: 60_000 });
  const rows = query.data;
  const attention = rows?.filter((row) => row.state !== "within review window").length;
  return (
    <section className="border-t border-[var(--color-border)] pt-6 space-y-3">
      <h3 className="font-serif text-xl">Market data coverage</h3>
      <p className="text-sm">
        Reporting periods and successful storage are tracked separately for each metric. Thresholds
        prompt review; they do not certify accuracy or predict the next release.
      </p>
      {query.isLoading && <p role="status">Checking market data…</p>}
      {query.error && <p role="alert">Market data health is unavailable.</p>}
      {rows && (
        <details open={Boolean(attention)}>
          <summary className="cursor-pointer">
            {attention} of {rows.length} metrics need review
          </summary>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Metric</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Reporting period</th>
                  <th className="p-2">Last stored</th>
                  <th className="p-2">Cadence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-[var(--color-border)]">
                    <td className="p-2">
                      {row.label}
                      <small className="block">{row.source}</small>
                    </td>
                    <td className="p-2">{row.state}</td>
                    <td className="p-2">
                      {row.asOf ? new Date(row.asOf).toLocaleDateString("en-AU") : "Missing"}
                    </td>
                    <td className="p-2">
                      {row.storedAt ? new Date(row.storedAt).toLocaleString("en-AU") : "Never"}
                    </td>
                    <td className="p-2">{row.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
