/** Trial cadence for Australian property readers; not a proven best-time claim. */
export const INSTAGRAM_TIMEZONE = "Australia/Sydney";
export const INSTAGRAM_FEED_SLOTS = {
  daily: { at: "07:30", dow: [1, 2, 3, 4, 5], graceMinutes: 60, label: "Mon–Fri · 7:30am" },
  stat: {
    at: "12:30",
    dow: [2, 4],
    excludeDom: [1],
    graceMinutes: 60,
    label: "Tue/Thu · 12:30pm (except the 1st)",
  },
  weekly: { at: "09:30", dow: [0], graceMinutes: 60, label: "Sunday · 9:30am" },
  monthly: { at: "12:30", dom: [1], graceMinutes: 60, label: "1st of the month · 12:30pm" },
};
export const REEL_WINDOW = {
  startMinute: 18 * 60 + 30,
  endMinute: 20 * 60,
  label: "6:30–8pm Sydney time",
};
export function inReelWindow(now: Date): boolean {
  const { minutes } = sydneySocialClock(now);
  return minutes >= REEL_WINDOW.startMinute && minutes < REEL_WINDOW.endMinute;
}

export type SocialClock = {
  /** Sydney calendar date, YYYY-MM-DD. */
  dateISO: string;
  /** Minutes since Sydney midnight (0–1439). */
  minutes: number;
  /** Day of week, 0 = Sunday … 6 = Saturday (Sydney). */
  dow: number;
  /** Day of the month, 1-31 (Sydney). */
  dom: number;
};

/** Current wall-clock in Australia/Sydney (DST-correct via the platform tz db). */
export function sydneySocialClock(d: Date = new Date()): SocialClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INSTAGRAM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some ICU builds emit "24" at midnight
  const minutes = hour * 60 + Number(get("minute"));
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    minutes,
    dow: dowMap[get("weekday")] ?? 0,
    dom: Number(get("day")),
  };
}
