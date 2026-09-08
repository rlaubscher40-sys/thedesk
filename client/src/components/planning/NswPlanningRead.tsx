import { trpc } from "@/lib/trpc";
import {
  NSW_PLANNING_ATTRIBUTION,
  NSW_PLANNING_DATASET,
  type NswPlanningRead as PlanningRead,
} from "../../../../shared/nswPlanning";

export function NswPlanningPanel() {
  const query = trpc.metrics.planningPilot.useQuery(undefined, {
    staleTime: 60 * 60_000,
    retry: false,
  });
  return <NswPlanningRead data={query.data} loading={query.isLoading} />;
}
function periodLabel(from: string): string {
  return new Date(`${from}T12:00:00Z`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function checkedAt(at: string): string {
  return new Date(at).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Sydney",
  });
}
export function NswPlanningRead({
  data,
  loading = false,
}: {
  data?: PlanningRead;
  loading?: boolean;
}) {
  const snapshot = data?.snapshot;
  return (
    <section
      id="nsw-planning"
      className="rule-major mt-10 pt-6 pb-6"
      aria-label="NSW planning pilot"
    >
      <p className="bs-label-accent">NSW planning · Council pilot</p>
      <h2 className="font-serif text-3xl font-bold mt-3">What is being proposed.</h2>
      <p className="font-serif text-lg text-[var(--color-fg-muted)] mt-3 max-w-[72ch]">
        City of Sydney council area only. This is one local government area within Greater Sydney.
      </p>
      {loading ? (
        <p className="mt-4" role="status">
          Checking the official planning feed…
        </p>
      ) : data?.status !== "available" || !snapshot ? (
        <p className="mt-4 text-[var(--color-fg-muted)]">
          The planning snapshot is unavailable right now. Missing data does not mean no
          applications.
        </p>
      ) : (
        <>
          <p className="mt-4 font-mono text-sm">
            Lodged {periodLabel(snapshot.from)} · {snapshot.from} to {snapshot.to}
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-5">
            <div>
              <dt className="text-sm text-[var(--color-fg-muted)]">Application records</dt>
              <dd className="font-serif text-4xl mt-1">
                {snapshot.applications.toLocaleString("en-AU")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-fg-muted)]">Original applications</dt>
              <dd className="font-serif text-4xl mt-1">
                {snapshot.originalApplications.toLocaleString("en-AU")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-fg-muted)]">Reported proposed dwellings</dt>
              <dd className="font-serif text-4xl mt-1">
                {snapshot.dwellings.reported === null
                  ? "Not reported"
                  : snapshot.dwellings.reported.toLocaleString("en-AU")}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-relaxed max-w-[85ch]">
            Dwelling counts are reported on {snapshot.dwellings.reportedApplications} of{" "}
            {snapshot.originalApplications} original applications.
            {snapshot.dwellings.missingApplications > 0
              ? ` ${snapshot.dwellings.missingApplications} omit that count. The figure above is a reported subtotal, not a complete council total.`
              : " All original applications in this snapshot report a dwelling count."}
            {` ${snapshot.modifications} modifications and ${snapshot.reviews} reviews are excluded from the dwelling subtotal.`}
          </p>
          <p className="mt-3 text-sm leading-relaxed max-w-[85ch]">
            These are proposals, not approvals, construction starts or completed homes. A
            determination date does not identify whether an application was approved or refused.
            These counts alone do not explain future prices or rents.
          </p>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer underline underline-offset-4">
              Evidence, status and revisions
            </summary>
            <div className="space-y-3 mt-3 max-w-[85ch] text-[var(--color-fg-muted)]">
              <p>
                Checked {checkedAt(snapshot.retrievedAt)} Sydney time. Every reported page passed
                count and duplicate-identity checks. The source updates daily and may change during
                a paginated read; this is not a frozen source release.
              </p>
              <p>
                Coverage: applications lodged through the NSW Planning Portal. Mandatory council use
                began on 1 July 2021. Dwelling-field coverage is shown above; no missing values are
                estimated.
              </p>
              <ul className="list-disc pl-5">
                {Object.entries(snapshot.statusCounts).map(([status, count]) => (
                  <li key={status}>
                    {status}: {count}
                  </li>
                ))}
              </ul>
              {snapshot.sourceUpdatedRange && (
                <p>
                  Source record update stamps: {snapshot.sourceUpdatedRange.earliest} to{" "}
                  {snapshot.sourceUpdatedRange.latest}. These are the source's literal timestamps;
                  they are not publication dates.
                </p>
              )}
              {data.previous.length > 0 ? (
                <>
                  <p>
                    Earlier checks of the same lodgement period are retained. Changes below are
                    source revisions, not growth from one month to another.
                  </p>
                  <ul className="list-disc pl-5">
                    {data.previous.map((previous, i) => (
                      <li key={`${previous.retrievedAt}:${i}`}>
                        {checkedAt(previous.retrievedAt)}: {previous.applications} application
                        records; {previous.dwellings.reported ?? "no reported"} proposed dwellings
                        from {previous.dwellings.reportedApplications} original applications.
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  This is the first stored check of this period. There is no earlier snapshot for a
                  revision comparison.
                </p>
              )}
            </div>
          </details>
        </>
      )}
      <p className="mt-5 text-xs text-[var(--color-fg-muted)] max-w-[90ch]">
        <a
          href={NSW_PLANNING_DATASET}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          Official NSW Online DA dataset
        </a>
        {` · ${NSW_PLANNING_ATTRIBUTION}. Used under CC BY 4.0. The Desk aggregates the source records.`}
      </p>
    </section>
  );
}
