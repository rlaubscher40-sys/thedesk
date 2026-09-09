import { sydneySocialClock } from "./instagramSchedule";
/** The signup promise is a weekday brief; feed ingestion also runs on weekends. */
export function isWeekdayBriefDate(feedDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(feedDate)) return false;
  const date = new Date(`${feedDate}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== feedDate)
    return false;
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/** The advertised 7am brief can recover until noon on the same Sydney weekday. */
export function dailyBriefWindow(now = new Date()): string | null {
  const clock = sydneySocialClock(now);
  return clock.dow >= 1 && clock.dow <= 5 && clock.minutes >= 420 && clock.minutes < 720
    ? clock.dateISO
    : null;
}
