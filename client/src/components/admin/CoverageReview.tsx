import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { sydneySocialClock } from "@shared/instagramSchedule";
import {
  COVERAGE_LABELS,
  coverageSaveSchema,
  type CoverageEntry,
  type evaluateCoverage,
} from "@shared/editorialCoverage";

export function CoverageResults({ review }: { review: ReturnType<typeof evaluateCoverage> }) {
  return (
    <div className="mt-3 text-sm space-y-3">
      {!!review.failedSources.length && (
        <p>
          Source failures recorded in this window: {review.failedSources.join(", ")}. A failed
          source alone does not establish that an event was missed.
        </p>
      )}
      <p className="font-semibold">
        {review.reviewed
          ? `${review.confirmed} of ${review.reviewed} reviewed events have confirmed local coverage`
          : "No editor-reviewed benchmark yet"}
      </p>
      <p>
        Matching window: {review.start} to {review.day}, Sydney dates. {review.runCount} saved
        collection reports.{" "}
        {review.sampledRuns > 0 && "Some reports contain only sampled decisions."}
      </p>
      <p>
        No matching record means unknown. Add alternative articles about the same event before
        treating it as a miss. These checks do not measure factual accuracy, overall recall or every
        social format. Instagram carousel delivery below requires a saved confirmation receipt.
      </p>
      <p>
        Follow-ups: {review.followups.open} open · {review.followups.awaitingRecheck} awaiting
        recheck · {review.followups.observedAfterFix} with publication observed after the fix.
      </p>
      {!review.rows.length && (
        <p>Add expected stories independently of The Desk’s feed to begin a review.</p>
      )}
      <ul className="space-y-3">
        {review.rows.map(
          ({ entry, status, publications, decisions, social, remediation, nextCheck }) => (
            <li key={entry.id} className="border-t border-[var(--color-border)] pt-3">
              <strong>{entry.title}</strong>
              {!entry.reviewed && <span> · Provisional</span>}
              <p>{COVERAGE_LABELS[status]}</p>
              {publications.map((p) => (
                <p key={p.id}>
                  <a
                    className="underline"
                    href={p.sourceUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.title}
                  </a>{" "}
                  · {p.channel} · {p.feedDate}
                </p>
              ))}
              {decisions[0] && (
                <p className="opacity-70">
                  Latest matching decision: {decisions[0].reason.replaceAll("-", " ")} ·{" "}
                  {decisions[0].at}
                </p>
              )}
              <p className="mt-1">Next check: {nextCheck}</p>
              {publications.length > 0 && (
                <p className="mt-1">
                  Instagram carousel:{" "}
                  {social.length
                    ? social
                        .map((s) =>
                          s.state === "confirmed"
                            ? `confirmed media ${s.mediaId} at ${s.confirmedAt}`
                            : "reserved or uncertain; do not retry automatically"
                        )
                        .join(" · ")
                    : "no matched receipt; this does not establish a failed post or social eligibility"}
                  .
                </p>
              )}
              {entry.followup && (
                <p className="mt-1">
                  Follow-up: {entry.followup.stage} · {remediation?.replaceAll("-", " ")} ·{" "}
                  {entry.followup.note}
                  {entry.followup.changeUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        className="underline"
                        href={entry.followup.changeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Change record
                      </a>
                    </>
                  )}
                </p>
              )}
            </li>
          )
        )}
      </ul>
    </div>
  );
}
function ReviewEditor({
  day,
  version,
  initial,
  onSaved,
}: {
  day: string;
  version: number;
  initial: CoverageEntry[];
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState(initial);
  const [error, setError] = useState("");
  const mutation = trpc.health.saveCoverageReview.useMutation({
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });
  const update = (id: string, patch: Partial<CoverageEntry>) =>
    setEntries((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const field = "w-full rounded border border-[var(--color-border)] bg-transparent p-2 text-sm";
  return (
    <details className="mt-4 border-t border-[var(--color-border)] pt-3">
      <summary className="cursor-pointer font-semibold text-sm">Edit expected stories</summary>
      <p className="text-sm mt-2">
        Record why each event matters and link its original release. Add verified alternative
        reporting as extra links. Check “Reviewed” only after making that editorial decision.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = coverageSaveSchema.safeParse({
            day,
            version,
            entries: entries.map((entry) => ({
              ...entry,
              urls: entry.urls.map((url) => url.trim()).filter(Boolean),
            })),
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Check the review fields");
            return;
          }
          setError("");
          mutation.mutate(parsed.data);
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4 mt-3">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="rounded border border-[var(--color-border)] p-3 space-y-2"
            >
              <label className="block text-sm">
                Story {i + 1}
                <input
                  className={field}
                  value={entry.title}
                  maxLength={240}
                  onChange={(e) => update(entry.id, { title: e.target.value })}
                  required
                  minLength={5}
                />
              </label>
              <label className="block text-sm">
                Why this belongs in the briefing
                <textarea
                  className={field}
                  value={entry.rationale}
                  maxLength={600}
                  onChange={(e) => update(entry.id, { rationale: e.target.value })}
                  required
                  minLength={10}
                />
              </label>
              <label className="block text-sm">
                Article links, one per line
                <textarea
                  className={field}
                  value={entry.urls.join("\n")}
                  onChange={(e) => update(entry.id, { urls: e.target.value.split("\n") })}
                  required
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={entry.reviewed}
                  onChange={(e) => update(entry.id, { reviewed: e.target.checked })}
                />
                Reviewed: this event should be covered
              </label>
              <details>
                <summary className="cursor-pointer text-sm">Track a coverage fix</summary>
                <p className="text-sm mt-2">
                  Record the diagnosed failure and a concrete change. Existing publication before
                  implementation cannot close the follow-up.
                </p>
                <label className="block text-sm mt-2">
                  Failure stage
                  <select
                    className={field}
                    value={entry.followup?.stage ?? ""}
                    onChange={(e) =>
                      update(entry.id, {
                        followup: e.target.value
                          ? {
                              note: "",
                              ...entry.followup,
                              stage: e.target.value as NonNullable<
                                CoverageEntry["followup"]
                              >["stage"],
                            }
                          : undefined,
                      })
                    }
                  >
                    <option value="">No follow-up</option>
                    {["discovery", "extraction", "selection", "publication"].map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
                {entry.followup && (
                  <>
                    <label className="block text-sm mt-2">
                      Evidence and fix
                      <textarea
                        className={field}
                        minLength={10}
                        maxLength={600}
                        required
                        value={entry.followup.note}
                        onChange={(e) =>
                          update(entry.id, {
                            followup: { ...entry.followup!, note: e.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="block text-sm mt-2">
                      Change or regression-test link
                      <input
                        className={field}
                        type="url"
                        value={entry.followup.changeUrl ?? ""}
                        onChange={(e) =>
                          update(entry.id, {
                            followup: {
                              ...entry.followup!,
                              changeUrl: e.target.value || undefined,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm mt-2">
                      <input
                        type="checkbox"
                        checked={!!entry.followup.implementedAt}
                        onChange={(e) =>
                          update(entry.id, {
                            followup: {
                              ...entry.followup!,
                              implementedAt: e.target.checked
                                ? new Date().toISOString()
                                : undefined,
                            },
                          })
                        }
                      />
                      Implemented; awaiting new publication evidence
                    </label>
                  </>
                )}
              </details>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => setEntries((rows) => rows.filter((r) => r.id !== entry.id))}
              >
                Remove from review
              </button>
            </div>
          ))}
          <div className="flex gap-4 text-sm">
            <button
              type="button"
              className="underline"
              disabled={entries.length >= 30}
              onClick={() =>
                setEntries((rows) => [
                  ...rows,
                  {
                    id: crypto.randomUUID(),
                    title: "",
                    rationale: "",
                    urls: [""],
                    reviewed: false,
                  },
                ])
              }
            >
              Add expected story
            </button>
            <button type="submit" className="border rounded px-3 py-2">
              {mutation.isPending ? "Saving…" : "Save review"}
            </button>
          </div>
        </fieldset>
        <p className="text-sm mt-2">
          Results above use the saved review. Save changes to update them.
        </p>
        {error && (
          <p role="alert" className="text-sm mt-2">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
export function CoverageReview() {
  const [day, setDay] = useState(() => sydneySocialClock().dateISO);
  const query = trpc.health.coverageReview.useQuery(
    { day },
    { enabled: !!day, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false }
  );
  return (
    <section className="border border-[var(--color-border)] rounded-lg p-4">
      <h3 className="font-semibold">Must-cover review</h3>
      <p className="mt-2 text-sm">
        Compare an independently chosen story list with what actually reached Australia and
        Property. Keep daily reviews to build evidence over time.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
        <label>
          Review day{" "}
          <input
            aria-label="Coverage review day"
            type="date"
            value={day}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
            className="border rounded bg-transparent p-1"
          />
        </label>
        <button className="underline" onClick={() => query.refetch()} disabled={query.isFetching}>
          Reload latest
        </button>
      </div>
      {query.isLoading ? (
        <p className="text-sm mt-3">Loading review…</p>
      ) : query.isError ? (
        <p role="alert" className="text-sm mt-3">
          Coverage evidence is unavailable. {query.error.message}
        </p>
      ) : (
        query.data && (
          <>
            {!!query.data.days.length && (
              <label className="block text-sm mt-3">
                Saved reviews{" "}
                <select
                  aria-label="Saved coverage review"
                  value={query.data.days.some((d) => d.day === day) ? day : ""}
                  onChange={(e) => {
                    if (e.target.value) setDay(e.target.value);
                  }}
                  className="border rounded bg-transparent p-1"
                >
                  <option value="">Choose a saved day</option>
                  {query.data.days.map((d) => (
                    <option key={d.day} value={d.day}>
                      {d.day}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {query.data.evidenceLimited && (
              <p role="alert" className="text-sm mt-3">
                The evidence limit was reached. Unmatched events remain unknown.
              </p>
            )}
            <CoverageResults review={query.data} />
            <ReviewEditor
              key={`${day}:${query.data.version}`}
              day={day}
              version={query.data.version}
              initial={query.data.rows.map((r) => r.entry)}
              onSaved={() => void query.refetch()}
            />
          </>
        )
      )}
    </section>
  );
}
