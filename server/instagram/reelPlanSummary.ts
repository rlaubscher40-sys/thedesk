import { REEL_WINDOW, sydneySocialClock } from "../../shared/instagramSchedule";

const dayAfter = (day: string) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
/** Convert a Sydney evening to UTC using the timezone database, including DST. */
function atSydney(day: string, minutes: number) {
  const desired = Date.parse(`${day}T00:00:00Z`) + minutes * 60_000;
  let utc = desired;
  for (let i = 0; i < 3; i++) {
    const local = sydneySocialClock(new Date(utc));
    const represented = Date.parse(`${local.dateISO}T00:00:00Z`) + local.minutes * 60_000;
    utc += desired - represented;
  }
  return new Date(utc).toISOString();
}
export function nextReelWindow(now: Date, tomorrow = false) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid publishing clock.");
  const clock = sydneySocialClock(now);
  const day =
    tomorrow || clock.minutes >= REEL_WINDOW.endMinute ? dayAfter(clock.dateISO) : clock.dateISO;
  return {
    date: day,
    start: atSydney(day, REEL_WINDOW.startMinute),
    end: atSydney(day, REEL_WINDOW.endMinute),
    timeZone: "Australia/Sydney" as const,
  };
}

type Plan = {
  state: string;
  candidate?: { topic?: string; publication: { key: string; date: string } } | null;
  retryAt?: Date;
  postId?: string | null;
  lastConfirmedPublication?: {
    publication: { key: string; date: string };
    family: string;
    postId: string;
    publishedAt: Date;
  } | null;
};
export function describeReelPlan(
  plan: Plan,
  enabled: boolean,
  configured: boolean,
  now = new Date()
) {
  let window = nextReelWindow(now, ["daily-limit", "paused"].includes(plan.state));
  if (plan.retryAt && plan.retryAt.getTime() >= Date.parse(window.end))
    window = nextReelWindow(plan.retryAt);
  const blocked: Record<string, string> = {
    "no-evidence": "No eligible story has current verified evidence.",
    locked: "A publication outcome needs inspection. Reposting is locked to prevent duplicates.",
    unavailable: "The publication record cannot be checked.",
    paused:
      "Today's attempts are paused. A later attempt still depends on an unused publication record.",
    "daily-limit": "Today's automatic Reel slot has already been used.",
    published: "All currently eligible stories have already been published.",
  };
  const blockers = [
    ...(!enabled ? ["Automatic scheduling is disabled."] : []),
    ...(!configured ? ["Instagram is not configured."] : []),
    ...(blocked[plan.state] ? [blocked[plan.state]!] : []),
  ];
  const selection = !["published", "no-evidence", "locked", "unavailable"].includes(plan.state)
    ? plan.candidate
    : null;
  return {
    checkedAt: now.toISOString(),
    window,
    blockers,
    selectedTopic: selection?.topic ?? null,
    selectedPublication: selection?.publication ?? null,
    confirmedPostId: plan.state === "published" ? (plan.postId ?? null) : null,
    lastConfirmedPublication: plan.lastConfirmedPublication
      ? {
          ...plan.lastConfirmedPublication,
          publishedAt: plan.lastConfirmedPublication.publishedAt.toISOString(),
        }
      : null,
    retryAt: plan.retryAt?.toISOString() ?? null,
    earliestCheckAt:
      enabled &&
      configured &&
      selection &&
      !blockers.length &&
      ["scheduled", "ready", "retrying"].includes(plan.state)
        ? new Date(
            Math.max(now.getTime(), Date.parse(window.start), plan.retryAt?.getTime() ?? 0)
          ).toISOString()
        : null,
    timingNote:
      "This is an eligibility window, not a reserved posting time. Evidence, voice, rendering and Instagram must pass before publication.",
  };
}

let previous = "";
/** Safe operational visibility through runtime logs, without exposing credentials
 * or adding an unauthenticated admin endpoint. Emit only when the plan changes. */
export function logReelPlan(plan: Plan, enabled: boolean, configured: boolean, now = new Date()) {
  const summary = describeReelPlan(plan, enabled, configured, now);
  const record = {
    state: plan.state,
    selectedPublication: summary.selectedPublication,
    selectedTopic: summary.selectedTopic,
    window: summary.window,
    blockers: summary.blockers,
    retryAt: summary.retryAt,
    confirmedPostId: summary.confirmedPostId,
    lastConfirmedPublication: summary.lastConfirmedPublication,
  };
  const serialised = JSON.stringify(record);
  if (serialised !== previous) {
    previous = serialised;
    console.log(`[reel-plan] ${serialised}`);
  }
}
