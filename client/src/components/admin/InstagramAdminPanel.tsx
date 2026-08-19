import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  jobState,
  postedToday,
  slotHasPassed,
  type JobState,
  type PostedRow,
} from "@/lib/instagramRuns";
import { Skeleton } from "@/components/ui/Skeleton";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

/**
 * The three posting jobs, in the order they run through the day.
 *
 * `label` is the cover title each one actually carries on the grid — "Today's
 * Briefing" for the morning post, "The Wider Lens" for the midday one — not the
 * internal job key. The point of this panel is to answer "did the thing I can
 * see on my profile go out?", so it should use the names on the profile and
 * leave the reader no translation to do.
 *
 * Times and `dow` mirror the scheduler's own job table (server/scheduler) so
 * the "should this have posted by now?" read matches what actually runs.
 * `warning` is the second sentence of the confirmation prompt — what
 * specifically goes out if the click is a mistake.
 */
const RERUN_JOBS = [
  {
    job: "daily" as const,
    label: "Today's Briefing",
    full: "Today's Briefing",
    at: "07:13",
    dow: null,
    warning: "the morning carousel (top 3 AU/Property stories) plus its 24h Story frames",
  },
  {
    job: "coverage" as const,
    label: "The Wider Lens",
    full: "The Wider Lens",
    at: "12:13",
    dow: null,
    warning: "the midday carousel (Tech & Science, Business, Global)",
  },
  {
    job: "weekly" as const,
    // Shortened for the button; the full cover title is in the tooltip and the
    // confirmation prompt, where there's room for it.
    label: "This Week",
    full: "This Week in Australian Property",
    at: "09:19",
    dow: 0, // Sunday
    warning: "the latest weekly edition carousel",
  },
];

/** Label and colour for each job's state. "missing" is the only alarm. */
const STATE_STYLE: Record<JobState, { text: (at: string) => string; alarm: boolean }> = {
  posted: { text: () => "posted today", alarm: false },
  missing: { text: () => "not posted", alarm: true },
  pending: { text: (at) => at, alarm: false },
  unknown: { text: (at) => at, alarm: false },
};

/**
 * Re-run a posting job by hand. This is the affordance the scheduler's failure
 * alert email asks for — before it, "re-run by hand" meant a curl with the
 * scheduled key, which is not something you do from a phone.
 *
 * Two things this deliberately does NOT do. It doesn't fire without a
 * confirmation: the click publishes publicly and immediately, and Instagram has
 * no unsend. And it doesn't return early with a cheerful "queued" — the request
 * is held until the post is actually live (or actually failed), because a post
 * that quietly fails is the exact bug this area keeps relearning. Expect up to
 * a couple of minutes, and check the log below before clicking a second time.
 */
function RerunJobs({ posts, ready }: { posts: PostedRow[]; ready: boolean }) {
  const utils = trpc.useUtils();
  const [running, setRunning] = useState<string | null>(null);
  // Until the log has loaded we genuinely don't know, and guessing "not today"
  // would raise a false alarm on every page load.
  const done = ready ? postedToday(posts) : null;

  const rerun = trpc.instagram.rerun.useMutation({
    onSuccess: (res) => {
      utils.instagram.listAll.invalidate();
      utils.instagram.publishingStatus.invalidate();
      if (res.recovered) {
        toast.success("Already live — recorded the existing post, nothing reposted");
      } else {
        toast.success(res.headline ? `Posted: ${res.headline}` : "Posted");
      }
    },
    onError: (err) => toast.error(err.message ?? "Post failed"),
    onSettled: () => setRunning(null),
  });

  function stateOf(entry: (typeof RERUN_JOBS)[number]): JobState {
    return jobState(done ? done.has(entry.job) : null, slotHasPassed(entry.at, entry.dow));
  }

  function handleRun(entry: (typeof RERUN_JOBS)[number]) {
    // Spell out the duplicate case in the prompt itself. The button doesn't
    // refuse — re-posting after a deletion is legitimate — but it should never
    // be the thing that quietly puts two of the same carousel on the grid.
    const dupe =
      stateOf(entry) === "posted"
        ? " A post of this type is ALREADY recorded today, so this would be a second one."
        : "";
    if (
      !confirm(
        `Post "${entry.full}" to Instagram now? This publishes ${entry.warning} straight to the live account, and Instagram has no unsend.${dupe}`
      )
    )
      return;
    setRunning(entry.job);
    rerun.mutate({ job: entry.job });
  }

  return (
    <div className="rounded border border-[var(--color-border)] p-4 space-y-3">
      <div>
        <p className="overline-amber" style={{ letterSpacing: "0.18em", fontSize: "10px" }}>
          Re-run a post
        </p>
        <p className="text-xs text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch] leading-relaxed">
          For when a scheduled run failed and nothing went out. Publishes to the live account
          immediately, confirmation prompt only. Takes up to a couple of minutes, and the result
          lands in the log below, so check there before clicking twice.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {RERUN_JOBS.map((entry) => {
          const isRunning = rerun.isPending && running === entry.job;
          const state = stateOf(entry);
          const style = STATE_STYLE[state];
          const schedule = entry.dow === 0 ? `Sun ${entry.at}` : entry.at;
          return (
            <button
              key={entry.job}
              onClick={() => handleRun(entry)}
              disabled={rerun.isPending}
              title={
                state === "posted"
                  ? `"${entry.full}" already posted today (runs ${schedule})`
                  : state === "missing"
                    ? `"${entry.full}" was due at ${schedule} and has nothing recorded today`
                    : `"${entry.full}" — runs ${schedule}`
              }
              className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors disabled:opacity-50 bg-white/[0.04] text-[var(--color-fg)] hover:bg-white/[0.08]"
              style={{ boxShadow: "inset 0 0 0 1px var(--color-border)" }}
            >
              <RefreshCw className={`h-3 w-3 ${isRunning ? "animate-spin" : ""}`} aria-hidden />
              {isRunning ? "Posting…" : entry.label}
              <span
                className="normal-case tracking-normal"
                style={{
                  color: style.alarm ? "oklch(0.78 0.16 15)" : "var(--color-fg-subtle)",
                }}
              >
                {style.text(schedule)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Live content-publishing quota read straight from the Graph API: how many of
 * the documented ~50-posts-per-24h allowance the account has spent. NB this is
 * the quota limit, NOT the opaque "Action is blocked" integrity throttle that
 * stalls Stories — but it's the one number Instagram exposes, so it's a useful
 * sanity check that a run isn't anywhere near a real cap.
 */
function PublishingQuota() {
  const { data, isLoading } = trpc.instagram.publishingStatus.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  if (isLoading) return <Skeleton className="h-14 w-full rounded" />;
  if (!data) return null;

  const window = data.windowHours ?? 24;
  let detail: string;
  if (!data.configured) {
    detail = "Instagram not configured";
  } else if (data.error) {
    detail = `Couldn't read quota — ${data.error}`;
  } else if (data.usage == null || data.quota == null) {
    detail = "Quota unavailable from the API right now";
  } else {
    const remaining = Math.max(data.quota - data.usage, 0);
    detail = `${data.usage} of ${data.quota} used · ${remaining} left in the last ${window}h`;
  }

  const pct =
    data.usage != null && data.quota
      ? Math.min(Math.round((data.usage / data.quota) * 100), 100)
      : null;

  return (
    <div className="rounded border border-[var(--color-border)] p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="overline-amber"
          style={{ letterSpacing: "0.18em", fontSize: "10px" }}
        >
          Publishing quota
        </p>
        <p className="text-xs font-mono tabular-nums text-[var(--color-fg-muted)]">
          {data.usage != null && data.quota != null ? `${data.usage} / ${data.quota}` : "—"}
        </p>
      </div>
      {pct != null && (
        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400/70"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="text-xs text-[var(--color-fg-muted)]">{detail}</p>
    </div>
  );
}

export function InstagramAdminPanel() {
  const { data, isLoading } = trpc.instagram.listAll.useQuery();
  const posts = data ?? [];

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-6">
      <div>
        <p className="overline-amber mb-2" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
          Ruben on Instagram
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">Published posts</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Every feed post with engagement metrics fetched from the Instagram Insights API, and a
          manual trigger for each posting job when a scheduled run comes up empty.
        </p>
      </div>

      <PublishingQuota />

      <RerunJobs posts={posts} ready={!isLoading} />

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded" />
      ) : posts.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">No posts recorded yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-6 sm:-mx-8 px-6 sm:px-8">
          <table className="w-full text-xs border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Date", "Type", "Headline", "Likes", "Comments", "Reach", "Saved", "Shares"].map(
                  (h) => (
                    <th
                      key={h}
                      className="pb-2 text-left font-mono uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] pr-4 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr
                  key={p.mediaId}
                  className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-[var(--color-fg-muted)] whitespace-nowrap">
                    {p.feedDate ?? (p.editionNumber != null ? `Ed. ${p.editionNumber}` : "—")}
                  </td>
                  <td className="py-2.5 pr-4 font-mono uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] whitespace-nowrap">
                    {p.postType}
                  </td>
                  <td className="py-2.5 pr-4 max-w-[260px] truncate text-[var(--color-fg)]">
                    {p.headline ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.likes)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.comments)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.reach)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.saved)}
                  </td>
                  <td className="py-2.5 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.shares)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
