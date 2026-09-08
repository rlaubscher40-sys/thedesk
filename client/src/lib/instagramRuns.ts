import { sydneySocialClock } from "@shared/instagramSchedule";
/**
 * Which Instagram posting jobs already have a post recorded today.
 *
 * This is the first thing you want to know when a scheduler failure alert
 * lands: did anything actually go out? It's also what decides whether pressing
 * a re-run button is a recovery or a duplicate.
 *
 * Keyed on `createdAt`, deliberately NOT on `feedDate`. A scheduled run records
 * feedDate as null — only a hand-supplied date override ever sets it — so
 * keying on feedDate would report "nothing today" for every normal post and
 * make the panel useless exactly when it matters.
 *
 * Uses the Sydney calendar day even while the account owner travels: the same day
 * boundary the scheduler's watermark uses.
 */
export type PostedRow = { postType: string; createdAt: string | Date };

export function postedToday(posts: PostedRow[], now: Date = new Date()): Set<string> {
  const today = sydneySocialClock(now).dateISO;
  const out = new Set<string>();
  for (const p of posts) {
    const at = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
    if (!Number.isNaN(at.getTime()) && sydneySocialClock(at).dateISO === today) out.add(p.postType);
  }
  return out;
}

/**
 * Has this job's slot for today already come and gone?
 *
 * Without this, a "nothing posted today" indicator is useless: the weekly job
 * would read as missing every weekday, and the daily briefing every morning
 * before its morning slot, so the one case that matters — a job that should have posted
 * and didn't — would be lost in permanent noise.
 *
 * `dow` restricts the job to one weekday (0 = Sunday) and `dom` to one day of
 * the month, both matching the scheduler's own fields; null means every day.
 * Sydney clock, regardless of the device or server timezone.
 */
export function slotHasPassed(
  atHHMM: string,
  dow: number | number[] | null,
  now: Date = new Date(),
  dom: number | null = null,
  excludeDom: number[] = []
): boolean {
  const clock = sydneySocialClock(now);
  if (dow != null && !(Array.isArray(dow) ? dow : [dow]).includes(clock.dow)) return false;
  if (excludeDom.includes(clock.dom)) return false;
  // A monthly job has no slot on the other 30 days of the month. Without this
  // it would read as overdue from the 2nd onwards, every month.
  if (dom != null && clock.dom !== dom) return false;
  const [h, m] = atHHMM.split(":");
  const at = Number(h) * 60 + Number(m);
  if (!Number.isFinite(at)) return false;
  return clock.minutes >= at;
}

/**
 * What to show against a job: it posted, it should have posted and didn't, or
 * its slot hasn't come round yet. `posted` is null while the log is still
 * loading — we don't guess, because a wrong "missing" is an alarm.
 *
 * Two states exist purely to keep "missing" meaning something. "skipped" is a
 * job allowed to decide there was nothing worth posting — The Number does that
 * on a quiet day, by design. "manual" is a job with no slot at all, fired only
 * by hand — The Wider Lens, since it came off the schedule. Reporting either as
 * missing would put a permanent red flag on the panel and teach the reader to
 * ignore the one state that is meant to be alarming.
 */
export type JobState = "posted" | "missing" | "skipped" | "manual" | "pending" | "unknown";

export function jobState(
  posted: boolean | null,
  slotPassed: boolean,
  opts: {
    /** Job may legitimately publish nothing on a day it runs. */
    optional?: boolean;
    /** Job has no schedule; it only ever runs when someone presses the button. */
    manual?: boolean;
  } = {}
): JobState {
  if (posted == null) return "unknown";
  if (posted) return "posted";
  // Checked before the slot: an unscheduled job has no slot to have passed, so
  // asking whether its time has come round is meaningless.
  if (opts.manual) return "manual";
  if (!slotPassed) return "pending";
  return opts.optional ? "skipped" : "missing";
}
