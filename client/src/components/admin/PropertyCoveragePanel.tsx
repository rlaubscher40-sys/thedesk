import { trpc } from "@/lib/trpc";

export function PropertyCoveragePanel() {
  const query = trpc.health.propertyCoverage.useQuery(undefined, { refetchInterval: 60_000 });
  const data = query.data;
  return (
    <section className="space-y-4 border-t border-[var(--color-border)] pt-6">
      <h3 className="font-serif text-xl">Property evidence coverage</h3>
      {query.isLoading && <p role="status">Checking collection coverage…</p>}
      {query.error && <p role="alert">Could not load coverage. Collection health is unknown.</p>}
      {data && (
        <>
          <p className="text-sm">
            {data.schedulerEnabled
              ? "Hourly collection is enabled."
              : "Collection is disabled: enable the scheduler and scheduled API key."}{" "}
            Counts show dated evidence mentioning each state or its tracked cities in the past seven
            days. They do not certify complete coverage.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.regions.map((region) => (
              <div key={region.code} className="border border-[var(--color-border)] rounded p-3">
                <p className="font-bold">{region.name}</p>
                <p>{region.articles7d} records</p>
                <p className="text-xs mt-2">
                  {Object.entries(region.topics)
                    .map(([topic, count]) => `${topic}: ${count}`)
                    .join(" · ")}
                </p>
                {!region.articles7d && (
                  <p className="text-sm text-[var(--color-amber)]">Coverage gap</p>
                )}
              </div>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer">
              Inspect {data.sources.length} collection sources
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th className="p-2">Source</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Accepted / fetched</th>
                    <th className="p-2">Last checked</th>
                    <th className="p-2">Newest evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((source) => (
                    <tr key={source.id} className="border-t border-[var(--color-border)]">
                      <td className="p-2">{source.name}</td>
                      <td className="p-2">{source.state}</td>
                      <td className="p-2">
                        {source.accepted} / {source.fetched}
                      </td>
                      <td className="p-2">
                        {source.checkedAt
                          ? new Date(source.checkedAt).toLocaleString("en-AU")
                          : "Never"}
                      </td>
                      <td className="p-2">
                        {source.newestPublishedAt
                          ? new Date(source.newestPublishedAt).toLocaleDateString("en-AU")
                          : "None"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
