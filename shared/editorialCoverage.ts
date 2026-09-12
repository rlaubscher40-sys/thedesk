import { z } from "zod";
import { articleIdentity } from "../scripts/ingest/lib/dedupe";
import { sydneySocialClock } from "./instagramSchedule";
import type { EditorialReport } from "./editorial";

export const coverageDaySchema = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/)
  .refine((day) => {
    const date = new Date(`${day}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
  }, "Enter a valid calendar day");
const urlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }, "Use an HTTP(S) article link without credentials");
const coverageEntrySchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(5).max(240),
    urls: z.array(urlSchema).min(1).max(10),
    rationale: z.string().trim().min(10).max(600),
    reviewed: z.boolean(),
  })
  .strict();
export const coverageSaveSchema = z
  .object({
    day: coverageDaySchema,
    version: z.number().int().min(0).max(2147483646),
    entries: z.array(coverageEntrySchema).max(30),
  })
  .strict()
  .superRefine(({ entries }, ctx) => {
    const ids = new Set<string>();
    const urls = new Set<string>();
    for (const entry of entries) {
      if (ids.has(entry.id)) ctx.addIssue({ code: "custom", message: "Duplicate review entry" });
      ids.add(entry.id);
      for (const url of entry.urls) {
        const key = articleIdentity({ url, title: "" });
        if (urls.has(key))
          ctx.addIssue({
            code: "custom",
            message: "Each article link can belong to only one event",
          });
        urls.add(key);
      }
    }
  });
export type CoverageEntry = z.infer<typeof coverageEntrySchema>;
export type CoverageSave = z.infer<typeof coverageSaveSchema>;
export type CoveragePublication = {
  id: number;
  title: string;
  sourceUrl: string | null;
  channel: string;
  feedDate: string;
  createdAt: Date | string;
};
export const COVERAGE_LABELS = {
  published: "Published in Australia / Property",
  "other-lane": "Published in another section",
  "selected-unconfirmed": "Selected; publication not confirmed",
  "read-held": "Read and held",
  "seen-unread": "Discovered; not read",
  unknown: "No matching saved record",
} as const;
export function coverageStartDay(day: string) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
}
/** Exact canonical links plus explicitly reviewed alternatives. Never infer
 * event coverage from a similar headline or aggregate insertion count. */
export function evaluateCoverage(
  entries: CoverageEntry[],
  day: string,
  publications: CoveragePublication[],
  reports: EditorialReport[],
  now = new Date()
) {
  const start = coverageStartDay(day);
  const inWindow = (raw: Date | string) => {
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime()) || date > now) return false;
    const localDay = sydneySocialClock(date).dateISO;
    return localDay >= start && localDay <= day;
  };
  const runs = reports
    .filter((r) => inWindow(r.finishedAt))
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
  const rows = entries.map((entry) => {
    const keys = new Set(entry.urls.map((url) => articleIdentity({ url, title: "" })));
    const matches = (url: string | null) => !!url && keys.has(articleIdentity({ url, title: "" }));
    const found = publications.filter(
      (p) =>
        p.feedDate >= start && p.feedDate <= day && inWindow(p.createdAt) && matches(p.sourceUrl)
    );
    const published = found.filter((p) => ["AU", "PROPERTY"].includes(p.channel));
    const other = found.filter((p) => ["BUSINESS", "GLOBAL", "TECH"].includes(p.channel));
    const decisions = runs.flatMap((run) =>
      run.decisions
        .filter((d) => matches(d.url))
        .map((d) => ({ runId: run.runId, at: run.finishedAt, status: run.status, ...d }))
    );
    const latest = decisions[0];
    const status: keyof typeof COVERAGE_LABELS = published.length
      ? "published"
      : other.length
        ? "other-lane"
        : decisions.some((d) => d.selected)
          ? "selected-unconfirmed"
          : latest?.readAttempted
            ? "read-held"
            : latest
              ? "seen-unread"
              : "unknown";
    return {
      entry,
      status,
      publications: published.length ? published : other,
      decisions: decisions.slice(0, 10),
    };
  });
  const reviewed = rows.filter((r) => r.entry.reviewed);
  return {
    day,
    start,
    rows,
    reviewed: reviewed.length,
    confirmed: reviewed.filter((r) => r.status === "published").length,
    unknown: reviewed.filter((r) => r.status === "unknown").length,
    runCount: runs.length,
    sampledRuns: runs.filter(
      (r) => r.decisionCount === undefined || r.decisionCount > r.decisions.length
    ).length,
    failedSources: [
      ...new Set(runs.flatMap((r) => r.sources.filter((s) => s.error).map((s) => s.name))),
    ],
  };
}
