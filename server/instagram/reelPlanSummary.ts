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
  blockedPublication?: { key: string; date: string };
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
    "variety-held":
      "Available evidence repeats a narrative angle published within seven days. A different city is not a new story; the slot stays empty.",
    "no-evidence": "No eligible story has current verified evidence.",
    locked: "A publication outcome needs inspection. Reposting is locked to prevent duplicates.",
    unavailable: "The publication record cannot be checked.",
    paused:
      "Today's attempts are paused. A later attempt still depends on an unused publication record.",
    "daily-limit": "Today's automatic Reel slot has already been used.",
    exhausted:
      "All currently eligible stories have already been published. No new publication is selected.",
  };
  const blockers = [
    ...(!enabled ? ["Automatic scheduling is disabled."] : []),
    ...(!configured ? ["Instagram is not configured."] : []),
    ...(blocked[plan.state] ? [blocked[plan.state]!] : []),
  ];
  const selection = !["published", "exhausted", "no-evidence", "locked", "unavailable"].includes(
    plan.state
  )
    ? plan.candidate
    : null;
  return {
    checkedAt: now.toISOString(),
    nextAction:
      plan.state === "exhausted"
        ? "Wait for a new verified source period or add a reviewed evidence-backed recipe. Never reset publication locks to fill the calendar."
        : plan.state === "no-evidence"
          ? "Inspect source availability, reference periods and creative approval requirements."
          : plan.state === "locked" || plan.state === "unavailable"
            ? "Inspect the publication record before any retry."
            : null,
    window,
    blockers,
    selectedTopic: selection?.topic ?? null,
    selectedPublication: selection?.publication ?? null,
    blockedPublication: plan.blockedPublication ?? null,
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
    blockedPublication: summary.blockedPublication,
    selectedTopic: summary.selectedTopic,
    window: summary.window,
    blockers: summary.blockers,
    nextAction: summary.nextAction,
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
