import { sydneySocialClock } from "../../shared/instagramSchedule";

type Episode = {
  id: string;
  title: string;
  releaseDate: string | null;
  exportRegistered: boolean;
  state: string;
};
/** Dates and receipts, not the stale authoring queue, determine replenishment.
 * Registered archival approval is not a new human watch/listen attestation. */
export function documentaryRunway(episodes: Episode[], now = new Date()) {
  const today = sydneySocialClock(now).dateISO;
  const rows = episodes.map((episode) => ({
    ...episode,
    status:
      episode.state === "published"
        ? "published"
        : episode.state === "unavailable"
          ? "unknown"
          : episode.state !== "available"
            ? "publication-held"
            : !episode.exportRegistered
              ? "export-needed"
              : !episode.releaseDate
                ? "unscheduled"
                : episode.releaseDate < today
                  ? "missed-slot"
                  : "scheduled",
  }));
  const scheduled = rows
    .filter((row) => row.status === "scheduled")
    .sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!));
  const lastScheduled = scheduled.at(-1)?.releaseDate ?? null;
  const daysRemaining = lastScheduled
    ? Math.round((Date.parse(lastScheduled) - Date.parse(today)) / 86400000)
    : 0;
  const uncertain = rows.some(
    (row) => row.status === "unknown" || row.status === "publication-held"
  );
  const needsProduction = scheduled.length < 4 || daysRemaining < 14;
  return {
    rows,
    readyCount: scheduled.length,
    lastScheduled,
    daysRemaining,
    needsProduction,
    uncertain,
    nextAction: uncertain
      ? "Resolve unknown or held publication receipts before counting the remaining buffer. Research the next distinct subjects in parallel."
      : needsProduction
        ? "Start the next documentary batch now: research distinct subjects, verify turning points and money, clear pictures, render, then complete a full watch and listen before registering new release dates."
        : "Maintain four prepared films and at least fourteen days of scheduled runway. Review the next research briefs before the buffer falls below either threshold.",
  };
}
