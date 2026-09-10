import { trpc } from "@/lib/trpc";

export function EditorialHealth() {
  const query = trpc.health.editorial.useQuery(undefined, { refetchInterval: 60_000 });
  const latest = query.data?.[0]?.report;
  return (
    <section className="border border-[var(--color-border)] rounded-lg p-4">
      <h3 className="font-semibold">Story sourcing and selection</h3>
      <p className="mt-2 text-sm">
        Stories must have relevant reporting, enough readable source text and a usable publication
        date before they can earn a briefing slot. Selection scores measure editorial priority, not
        factual certainty.
      </p>
      {query.isLoading ? (
        <p className="mt-2 text-sm">Loading sourcing results…</p>
      ) : query.isError ? (
        <p className="mt-2 text-sm">Sourcing results are unavailable.</p>
      ) : !latest ? (
        <p className="mt-2 text-sm">
          Awaiting the first collection under the new editorial checks.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            Last run: {latest.finishedAt} · {latest.status}
          </p>
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              ["Discovered", latest.discovered],
              ["From hourly collection", latest.evidencePool],
              ["Article reads attempted", latest.read],
              ["Published", latest.inserted],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {!!latest.sources.filter((s) => s.error).length && (
            <div className="mt-4 text-sm">
              <h4 className="font-semibold">Sources needing attention</h4>
              <ul className="mt-2 space-y-1">
                {latest.sources
                  .filter((s) => s.error)
                  .map((s) => (
                    <li key={s.url}>
                      {s.name}: {s.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              Why stories were selected or held
            </summary>
            <p className="mt-2">
              Includes every article-read decision and a sample of earlier exclusions, capped at 300
              entries.
            </p>
            <ul className="mt-3 space-y-3">
              {latest.decisions.map((d, i) => (
                <li key={i}>
                  <span className="font-medium">{d.title}</span>
                  <br />
                  <span className="opacity-70">
                    {d.source} · {d.reason.replaceAll("-", " ")} · priority {d.score} ·{" "}
                    {d.textChars} extracted characters
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
