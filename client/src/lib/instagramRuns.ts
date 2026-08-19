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
 * Uses the local calendar day, which for this account is Sydney: the same day
 * boundary the scheduler's watermark uses.
 */
export type PostedRow = { postType: string; createdAt: string | Date };

export function postedToday(posts: PostedRow[], now: Date = new Date()): Set<string> {
  const today = now.toDateString();
  const out = new Set<string>();
  for (const p of posts) {
    const at = p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
    if (!Number.isNaN(at.getTime()) && at.toDateString() === today) out.add(p.postType);
  }
  return out;
}

/**
 * Has this job's slot for today already come and gone?
 *
 * Without this, a "nothing posted today" indicator is useless: the weekly job
 * would read as missing every weekday, and the midday coverage job every
 * morning, so the one case that matters — a job that should have posted and
 * didn't — would be lost in permanent noise.
 *
 * `dow` restricts the job to one weekday (0 = Sunday), matching the scheduler's
 * own `dow` field; null means every day. Local clock, same as postedToday.
 */
export function slotHasPassed(atHHMM: string, dow: number | null, now: Date = new Date()): boolean {
  if (dow != null && now.getDay() !== dow) return false;
  const [h, m] = atHHMM.split(":");
  const at = Number(h) * 60 + Number(m);
  if (!Number.isFinite(at)) return false;
  return now.getHours() * 60 + now.getMinutes() >= at;
}

/**
 * What to show against a job: it posted, it should have posted and didn't, or
 * its slot hasn't come round yet. `posted` is null while the log is still
 * loading — we don't guess, because a wrong "missing" is an alarm.
 */
export type JobState = "posted" | "missing" | "pending" | "unknown";

export function jobState(posted: boolean | null, slotPassed: boolean): JobState {
  if (posted == null) return "unknown";
  if (posted) return "posted";
  return slotPassed ? "missing" : "pending";
}
