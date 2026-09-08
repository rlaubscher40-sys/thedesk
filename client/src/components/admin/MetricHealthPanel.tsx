import { trpc } from "@/lib/trpc";

export function MetricHealthPanel() {
  const utils = trpc.useUtils();
  const query = trpc.health.metricCoverage.useQuery(undefined, { refetchInterval: 60_000 });
  const collection = trpc.health.metricCollection.useQuery(undefined, { refetchInterval: 5_000 });
  const refresh = trpc.health.refreshMetrics.useMutation({
    onSettled: () => {
      void utils.health.metricCoverage.invalidate();
      void utils.health.metricCollection.invalidate();
      void utils.health.summary.invalidate();
    },
  });
  // A completed manual refresh must not hide a newer scheduler report.
  const manualReport = refresh.data;
  const scheduledReport = collection.data?.lastReport;
  const report = manualReport && (!scheduledReport ||
    new Date(manualReport.finishedAt).getTime() > new Date(scheduledReport.finishedAt).getTime())
    ? manualReport : scheduledReport;
  const running = refresh.isPending || collection.data?.running;
  const rows = query.data;
  const attention = rows?.filter((row) => row.state !== "within review window").length;
  return (
    <section className="border-t border-[var(--color-border)] pt-6 space-y-3">
      <h3 className="font-serif text-xl">Market data coverage</h3>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={Boolean(running)}
          className="border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          {running ? "Collecting market data…" : "Refresh market data now"}
        </button>
        {running && (
          <p role="status" className="text-sm">
            Fetching source data and saving available metrics. This can take about a minute.
          </p>
        )}
        {collection.data && !collection.data.schedulerEnabled && (
          <p role="alert" className="text-sm">
            Automatic collection is disabled. Enable the scheduler and its scheduled key in hosting
            settings. You can still refresh here.
          </p>
        )}
        {(refresh.error || collection.data?.lastError) && (
          <p role="alert" className="text-sm">
            Collection failed: {refresh.error?.message ?? collection.data?.lastError}
          </p>
        )}
        {report && (
          <div role="status" className="text-sm space-y-1">
            <p>
              Last attempt: {new Date(report.finishedAt).toLocaleString("en-AU")}. Stored{" "}
              {report.stored} metrics.
            </p>
            {report.unavailable.length > 0 && (
              <p>
                Sources did not return: {report.unavailable.join(", ")}. Existing values have been
                retained.
              </p>
            )}
            {report.failedWrites.length > 0 && (
              <p>Could not save: {report.failedWrites.join(", ")}.</p>
            )}
            {report.sourceErrors?.map((error, index) => (
              <p key={`${error.metricKey}-${index}`}>
                {error.metricKey}: {error.reason}
              </p>
            ))}
          </div>
        )}
      </div>
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
