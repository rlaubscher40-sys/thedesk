import { z } from "zod";
import { sydneySocialClock } from "./instagramSchedule";
import { newsTimestamp, recentNewsTimestamp } from "./propertyNewsQuality";

/** Reported dates, never independent verification of the publisher's claims. */
export const sourceTimingSchema = z
  .object({
    feedReportedAt: z.string().max(100).datetime({ offset: true }).nullable(),
    publisherPublishedAt: z.string().max(100).datetime({ offset: true }).nullable(),
    publisherPublishedDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    publisherDateStatus: z.enum(["available", "missing", "invalid", "conflicting"]),
    retrievedAt: z.string().max(100).datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.publisherDateStatus === "available") !== (value.publisherPublishedAt !== null || !!value.publisherPublishedDay))
      ctx.addIssue({ code: "custom", message: "Publication date and status disagree" });
  });
export type SourceTiming = z.infer<typeof sourceTimingSchema>;

export function sourceTimingHold(input: unknown, now: Date, feedDate?: string): string | null {
  const parsed = sourceTimingSchema.safeParse(input);
  if (!parsed.success) return "missing-source-timing";
  const timing = parsed.data;
  const retrieved = newsTimestamp(timing.retrievedAt);
  if (!retrieved || !Number.isFinite(now.getTime()) || Date.parse(retrieved) > now.getTime())
    return "invalid-retrieval-date";
  if (feedDate !== undefined && sydneySocialClock(new Date(retrieved)).dateISO !== feedDate)
    return "source-timing-feed-date-mismatch";
  if (timing.feedReportedAt && !recentNewsTimestamp(timing.feedReportedAt, now)) return "old-or-invalid-feed-date";
  if (!timing.feedReportedAt && !timing.publisherPublishedAt && !timing.publisherPublishedDay) return "old-or-invalid-feed-date";
  if (["invalid", "conflicting"].includes(timing.publisherDateStatus))
    return "unusable-publisher-date";
  if (timing.publisherPublishedAt && !recentNewsTimestamp(timing.publisherPublishedAt, now))
    return "old-or-future-publisher-date";
  if (timing.publisherPublishedDay) {
    const day = Date.parse(`${timing.publisherPublishedDay}T00:00:00Z`);
    const today = Date.parse(`${sydneySocialClock(now).dateISO}T00:00:00Z`);
    if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== timing.publisherPublishedDay || day > today || today - day > 3 * 86_400_000)
      return "old-or-future-publisher-date";
  }
  return null;
}

/** Social selection evaluates freshness when this dated briefing was collected. */
export function datedBriefingHold(timing: unknown, feedDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(feedDate)) return "source-timing-feed-date-mismatch";
  const parsed = sourceTimingSchema.safeParse(timing);
  return parsed.success
    ? sourceTimingHold(parsed.data, new Date(parsed.data.retrievedAt), feedDate)
    : "missing-source-timing";
}

export function sourceTimingLabel(timing: SourceTiming | null | undefined): string {
  if (!timing) return "Original publication date not recorded";
  if (timing.publisherDateStatus === "available" && timing.publisherPublishedDay) return `Publisher reports publication: ${timing.publisherPublishedDay} (day only)`;
  if (timing.publisherDateStatus === "available" && newsTimestamp(timing.publisherPublishedAt))
    return `Publisher reports publication: ${sydneySocialClock(new Date(timing.publisherPublishedAt!)).dateISO}`;
  if (["invalid", "conflicting"].includes(timing.publisherDateStatus))
    return "Publisher publication date is unclear";
  return timing.feedReportedAt && newsTimestamp(timing.feedReportedAt)
    ? `Feed-reported date: ${sydneySocialClock(new Date(timing.feedReportedAt)).dateISO} · original publication date unconfirmed`
    : "Original publication date not recorded";
}
