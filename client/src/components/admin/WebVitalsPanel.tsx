import { trpc } from "@/lib/trpc";
export function WebVitalsPanel() {
  const query = trpc.analytics.vitals.useQuery(undefined, { staleTime: 60_000 });
  return (
    <section className="rule-major mt-7 pt-4">
      <h2 className="font-serif text-2xl">Reader experience</h2>
      <p className="text-sm mt-2">
        Document-level measurements from the last 7 days, split by initial viewport. No reader
        identities are collected. Targets use the 75th percentile. Fewer than 100 observations is an
        early signal, not a release verdict.
      </p>
      {query.isLoading ? (
        <p role="status">Loading measurements…</p>
      ) : query.isError ? (
        <p role="alert">
          Measurements unavailable.{" "}
          <button className="underline min-h-11" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-3">Device / metric</th>
                <th>p75</th>
                <th>Target</th>
                <th>Samples</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.rows.map((row) => (
                <tr key={`${row.device}-${row.name}`} className="rule-hair">
                  <th className="py-3 font-normal">
                    {row.device} · {row.name}
                  </th>
                  <td>
                    {row.p75 == null
                      ? "Awaiting observations"
                      : `${row.name === "CLS" ? row.p75.toFixed(3) : Math.round(row.p75)}${row.name === "CLS" ? "" : " ms"}`}
                  </td>
                  <td>
                    ≤ {row.target}
                    {row.name === "CLS" ? "" : " ms"}
                  </td>
                  <td>{row.count.toLocaleString("en-AU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.data?.capped && (
            <p className="text-sm mt-3">Showing the latest 5,000 observations.</p>
          )}
        </div>
      )}
    </section>
  );
}
