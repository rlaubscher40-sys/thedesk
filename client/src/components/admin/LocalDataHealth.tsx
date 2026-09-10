import { VicWorkbookUpload } from "./VicWorkbookUpload";
import { trpc } from "@/lib/trpc";
import { LocalTransferHealth } from "./LocalTransferHealth";
export function LocalDataHealth() {
  const query = trpc.health.localDataCoverage.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  return (
    <section className="mt-8 border-t border-[var(--color-rule)] pt-6">
      <h3 className="font-serif text-2xl">Local dataset coverage</h3>
      <p className="text-sm mt-3">
        Enabled sources are checked daily; reviewed imports are labelled separately. Changed workbooks are parsed once. These collectors
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
            <p className="mt-2 text-sm font-semibold">{source.collectionState}</p>
            <p className="mt-2 text-sm">
              {source.areas} source-defined areas · {source.cadence} publication
              · Period: {source.period ?? "Not collected"}
            </p>
            <p className="mt-2 text-sm">
              {source.sourceKey === "vic-bond-rents" ? "Last catalogue/update check" : "Last check"}: {source.checkedAt ?? "Never"}
            </p>
            <p className="mt-2 text-sm">
              Across stored reporting periods: {source.observationCoverage.published} published figures ·{" "}
              {source.observationCoverage.notPublished} not published (source suppression) ·{" "}
              {source.observationCoverage.insufficientSample} withheld under sample rules ·{" "}
              {source.observationCoverage.sourceUnavailable} unavailable with no reason stated in the source.
              Missing records are not proof that a publisher did not publish them.
            </p>
            {source.sourceKey === "vic-bond-rents" && (
              <div className="mt-2 text-sm">
                <p>DataVic is checked daily. A newer listed quarter triggers a validated download. An unchanged catalogue does not prove workbook download access or mean these rents are current. Same-quarter corrections require a reviewed upload.</p>
                <VicWorkbookUpload onImported={() => { void query.refetch(); }} />
              </div>
            )}
            {source.accessPaused ? (
              <p className="mt-2 text-sm font-semibold">
                Collection paused: the publisher denied access. Automatic
                retries are stopped until source access is reviewed.{" "}
                {source.error}. Stored releases remain available; automatic
                updates are not verified.
              </p>
            ) : (
              source.error && (
                <p className="mt-2 text-sm">
                  Last attempt failed: {source.error}. Any prior snapshot is
                  retained.
                </p>
              )
            )}
            {source.older && (
              <p className="mt-2 text-sm">
                Older reporting period — review the publisher release.
              </p>
            )}
            {source.provenance === "reviewed-release" && (
              <p className="mt-2 text-sm">
                Reviewed release imported from the openly licensed publisher
                workbook {source.acquisition === "user-upload" ? "supplied for review" : "retrieved"} {source.retrievedAt?.slice(0, 10)}. The
                import does not establish a successful automatic source check.
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
      <LocalTransferHealth />
    </section>
  );
}
