import { trpc } from "@/lib/trpc";
export function LocalDataHealth() {
  const query = trpc.health.localDataCoverage.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  return (
    <section className="mt-8 border-t border-[var(--color-rule)] pt-6">
      <h3 className="font-serif text-2xl">Local dataset coverage</h3>
      <p className="text-sm mt-3">
        Daily source checks; changed workbooks are parsed once. These collectors
        use no LLM. A reporting period is separate from the last successful
        check.
      </p>
      {query.isLoading ? (
        <p className="mt-3">Loading coverage…</p>
      ) : query.isError ? (
        <p className="mt-3">Coverage could not be read.</p>
      ) : (
        query.data?.map((source) => (
          <article
            key={source.sourceKey}
            className="border border-[var(--color-rule)] p-4 mt-4"
          >
            <h4 className="font-semibold">{source.label}</h4>
            <p className="mt-2 text-sm">
              {source.areas} source-defined areas · {source.cadence} publication
              · Period: {source.period ?? "Not collected"}
            </p>
            <p className="mt-2 text-sm">
              Last check: {source.checkedAt ?? "Never"}
            </p>
            {source.error && (
              <p className="mt-2 text-sm">
                Last attempt failed: {source.error}. Any prior snapshot is
                retained.
              </p>
            )}
            {source.older && (
              <p className="mt-2 text-sm">
                Older reporting period — review the publisher release.
              </p>
            )}
            <p className="mt-2 text-sm">
              {Object.entries(source.states)
                .filter(([, count]) => count > 0)
                .map(([state, count]) => `${state}: ${count}`)
                .join(" · ") || "No areas collected yet"}
            </p>
            {source.excludedRows > 0 && (
              <p className="mt-2 text-sm">
                {source.excludedRows} source rows excluded under the documented
                validation rules.
              </p>
            )}
          </article>
        ))
      )}
    </section>
  );
}
