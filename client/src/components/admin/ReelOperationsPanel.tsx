import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { REEL_REVIEW_CHECKS, reelReviewOutcome, type ReelReviewSave } from "@shared/reelReview";
import { firstDayReading, inInsightWindow, validMetricCount } from "@shared/instagramMeasurement";
import { trpc } from "@/lib/trpc";

type Post = inferRouterOutputs<AppRouter>["instagram"]["reelOperations"]["posts"][number];
const control = "rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-sm";
const number = (value: number | null) => (value === null ? "Unavailable" : value.toFixed(1));

function ReviewForm({ post }: { post: Post }) {
  const utils = trpc.useUtils();
  const [review, setReview] = useState<ReelReviewSave>(
    () =>
      post.review?.review ?? {
        publication: post.publication,
        postId: post.postId,
        videoSha256: post.render!.videoSha256,
        version: 0,
        watchedAndListened: false,
        checks: {
          hook: "pending",
          progression: "pending",
          evidence: "pending",
          pictures: "pending",
          voice: "pending",
          sync: "pending",
        },
        notes: "",
        nextTest: "",
      }
  );
  const save = trpc.instagram.saveReelReview.useMutation({
    onSuccess: async (saved) => {
      setReview(saved.review);
      await utils.instagram.reelOperations.invalidate();
    },
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(review);
      }}
    >
      <p>
        Review outcome: <strong>{reelReviewOutcome(review)}</strong>
        {save.isSuccess && JSON.stringify(save.data.review) === JSON.stringify(review)
          ? " · saved"
          : ""}
      </p>
      {post.review && (
        <p className="text-xs">
          Last saved by admin {post.review.reviewerId} on{" "}
          {new Date(post.review.reviewedAt).toLocaleString("en-AU")}.
        </p>
      )}
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={review.watchedAndListened}
          onChange={(event) => setReview({ ...review, watchedAndListened: event.target.checked })}
        />
        <span>
          I watched and listened to the complete submitted export identified below, including
          captions and sound. This is my review, not an automated result.
        </span>
      </label>
      <p className="break-all text-xs">MP4 SHA-256: {review.videoSha256}</p>
      {Object.entries(REEL_REVIEW_CHECKS).map(([key, question]) => (
        <label
          key={key}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <span>{question}</span>
          <select
            aria-label={question}
            className={control}
            value={review.checks[key as keyof typeof REEL_REVIEW_CHECKS]}
            onChange={(event) =>
              setReview({ ...review, checks: { ...review.checks, [key]: event.target.value } })
            }
          >
            <option value="pending">Not reviewed</option>
            <option value="pass">Pass</option>
            <option value="fix">Needs work</option>
          </select>
        </label>
      ))}
      <label className="block">
        Timestamped observations and fixes
        <textarea
          className={`${control} block w-full mt-1`}
          rows={3}
          maxLength={4000}
          placeholder="00:14 — pause after the figure needs more space…"
          value={review.notes}
          onChange={(event) => setReview({ ...review, notes: event.target.value })}
        />
      </label>
      <label className="block">
        One change to test in a future Reel
        <textarea
          className={`${control} block w-full mt-1`}
          rows={2}
          maxLength={1500}
          placeholder="Change, hypothesis, metric and comparison cohort. Keep other settings fixed."
          value={review.nextTest}
          onChange={(event) => setReview({ ...review, nextTest: event.target.value })}
        />
      </label>
      <p className="text-xs">
        Saving records observations for future production. It does not approve a release, replace a
        video or change the publishing schedule.
      </p>
      {save.error && <p role="alert">{save.error.message}</p>}
      <button
        className={control}
        disabled={save.isPending || post.reviewState === "unavailable"}
        type="submit"
      >
        {save.isPending ? "Saving…" : "Save review"}
      </button>
      {post.review && (
        <button
          type="button"
          className={control}
          disabled={save.isPending}
          onClick={() => {
            setReview(post.review!.review);
            save.reset();
          }}
        >
          Load latest saved review
        </button>
      )}
    </form>
  );
}

function PostReview({ post }: { post: Post }) {
  const reading = post.measurement ? firstDayReading(post.measurement) : null;
  const delivery = post.render?.delivery;
  return (
    <div className="space-y-3">
      <p>
        {post.headline} · Media ID {post.postId}
      </p>
      {reading && inInsightWindow(reading) ? (
        <p>
          First-day reach: {reading.reach ?? "Unavailable"}. Saves: {reading.saved ?? "Unavailable"}
          . Shares: {reading.shares ?? "Unavailable"}.
          {validMetricCount(reading.reach) && reading.reach > 0 && (
            <>
              {" "}
              Per 1,000 reached: saves{" "}
              {number(
                validMetricCount(reading.saved) ? (reading.saved / reading.reach) * 1000 : null
              )}
              , shares{" "}
              {number(
                validMetricCount(reading.shares) ? (reading.shares / reading.reach) * 1000 : null
              )}
              .
            </>
          )}
        </p>
      ) : (
        <p>No usable 24–48-hour audience reading for this Reel.</p>
      )}
      {post.render ? (
        <>
          <p>
            Recorded export: {post.render.seconds.toFixed(1)}s · {post.render.recipe} ·{" "}
            {post.render.voice.engine} · speed {post.render.voice.speed}.
          </p>
          {delivery ? (
            <div>
              <p>
                Delivery: {delivery.profile} · {delivery.scriptWordsPerMinute.toFixed(1)} script
                words/minute · audition range {delivery.targetWpm.join("–")} ·{" "}
                {delivery.boundaries.length} protected boundaries.
              </p>
              <p className="text-xs">
                Word counts are approximate when figures expand in speech. Pace flags are listening
                prompts, not pass/fail scores.
              </p>
              <ul className="list-disc pl-5">
                {delivery.passages
                  .filter((passage) => passage.flags.length)
                  .map((passage) => (
                    <li key={passage.key}>
                      {passage.key}: {passage.scriptWordsPerMinute.toFixed(1)} words/minute ·{" "}
                      {passage.flags.join(", ")}
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <p>Delivery diagnostics were not recorded for this export.</p>
          )}
          {post.reviewState === "unavailable" ? (
            <p role="alert">The saved human review could not be read. Refresh before editing.</p>
          ) : (
            <ReviewForm key={`${post.postId}:${post.render.videoSha256}`} post={post} />
          )}
        </>
      ) : (
        <p>
          {post.sourceState === "unavailable"
            ? "Export provenance could not be read."
            : "No export provenance was saved."}{" "}
          An exact-video review cannot be recorded until its identity is known.
        </p>
      )}
    </div>
  );
}

export function ReelOperationsPanel() {
  const query = trpc.instagram.reelOperations.useQuery(undefined, { staleTime: 60_000 });
  const [selected, setSelected] = useState("");
  const report = query.data;
  const post = report?.posts.find((item) => item.postId === selected) ?? report?.posts[0];
  return (
    <details className="rounded border border-[var(--color-border)] p-3 text-sm space-y-3">
      <summary className="cursor-pointer font-semibold">
        Reel quality, audience learning and production buffer
      </summary>
      {query.error && (
        <p role="alert">
          The operations report is unavailable. Missing evidence has not been counted as success.
        </p>
      )}
      {!report && !query.error && <p>Loading confirmed publications and review evidence…</p>}
      {report && (
        <>
          <button
            type="button"
            className={control}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh report
          </button>
          <h4 className="font-semibold">Documentary production buffer</h4>
          <p>
            {report.runway.readyCount} registered, unpublished exports still have eligible dates.
            Last scheduled: {report.runway.lastScheduled ?? "none"} · {report.runway.daysRemaining}{" "}
            days remaining.
          </p>
          <p>
            <strong>
              {report.runway.needsProduction ? "Production needed: " : "Next action: "}
            </strong>
            {report.runway.nextAction}
          </p>
          <ul className="list-disc pl-5">
            {report.runway.rows.map((row) => (
              <li key={row.id}>
                {row.title} · {row.releaseDate ?? "unscheduled"} · {row.status.replaceAll("-", " ")}
              </li>
            ))}
          </ul>
          <p className="text-xs">
            Release registration uses the existing exact-export records. It does not imply a new
            full watch or listen. Missed slots are not automatically republished.
          </p>
          <h4 className="font-semibold">Audience learning</h4>
          <p>
            Up to {report.historyLimit} confirmed publications. Cohorts separate recipe, voice,
            delivery profile, 15-second duration band and six-hour measurement age. Existing
            first-day readings remain fixed.
          </p>
          <p className="text-xs">
            Excluded: {report.learning.excluded.outsideWindow} missing/outside the 24–48h window;{" "}
            {report.learning.excluded.noReach} missing/zero reach;{" "}
            {report.learning.excluded.noProvenance} missing export identity;{" "}
            {report.learning.excluded.duplicate} duplicate media IDs.
          </p>
          {report.learning.cohorts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="p-2">Cohort</th>
                    <th className="p-2">Posts</th>
                    <th className="p-2">Median reach</th>
                    <th className="p-2">Saves / 1k</th>
                    <th className="p-2">Shares / 1k</th>
                  </tr>
                </thead>
                <tbody>
                  {report.learning.cohorts.map((cohort) => (
                    <tr
                      key={JSON.stringify([
                        cohort.family,
                        cohort.recipe,
                        cohort.profile,
                        cohort.voice,
                        cohort.durationBand,
                        cohort.ageBand,
                      ])}
                    >
                      <td className="p-2">
                        <details>
                          <summary className="cursor-pointer">
                            {cohort.family} · {cohort.recipe}
                            <br />
                            {cohort.profile} · {cohort.durationBand} · {cohort.ageBand}
                          </summary>
                          <p className="break-all">{cohort.voice}</p>
                          <p>{cohort.nextAction}</p>
                        </details>
                      </td>
                      <td className="p-2">{cohort.posts}</td>
                      <td className="p-2">{number(cohort.medianReach)}</td>
                      <td className="p-2">
                        {number(cohort.savesPerThousand)} (n={cohort.savesSamples})
                      </td>
                      <td className="p-2">
                        {number(cohort.sharesPerThousand)} (n={cohort.sharesSamples})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              No comparable cohort yet. New confirmed exports and first-day readings will populate
              this report.
            </p>
          )}
          <p className="text-xs">
            Descriptive observations only: topic, audience and distribution still differ. Reach and
            saves do not measure retention or completion; watch-time metrics are not collected here.
            No automatic winner or voice change is inferred.
          </p>
          <h4 className="font-semibold">Watch, listen and record the next improvement</h4>
          {post ? (
            <>
              <label className="block">
                Confirmed Reel
                <select
                  className={`${control} block w-full mt-1`}
                  value={post.postId}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {report.posts.map((item) => (
                    <option value={item.postId} key={item.postId}>
                      {item.headline} · {item.postId}
                    </option>
                  ))}
                </select>
              </label>
              <PostReview key={post.postId} post={post} />
            </>
          ) : (
            <p>No confirmed Reel receipts are available yet.</p>
          )}
        </>
      )}
    </details>
  );
}
