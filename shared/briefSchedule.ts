/** The signup promise is a weekday brief; feed ingestion also runs on weekends. */
export function isWeekdayBriefDate(feedDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(feedDate)) return false;
  const date = new Date(`${feedDate}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== feedDate) return false;
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}
