import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { jobRuns } from "./schema";
import { getDb } from "./client";
import { storyPublicationKeys } from "../instagram/socialProvenance";
import type { CoveragePublication, CoverageSocialRecord } from "../../shared/editorialCoverage";

const receipt = z.object({
  postId: z.string().regex(/^\d{1,64}$/),
  storyIds: z.array(z.number().int().positive().safe()).min(1).max(4),
});
/** Trace the exact source reservations, then require the article ID in a valid
 * confirmation receipt. A matching title lock alone never proves delivery. */
export async function coverageSocialEvidence(
  publications: CoveragePublication[],
  db: NonNullable<ReturnType<typeof getDb>>
) {
  const keys = new Map(publications.map((p) => [p.id, storyPublicationKeys(p)]));
  const all = [...new Set([...keys.values()].flat())];
  if (!all.length) return [];
  const rows = await db
    .select({
      jobKey: jobRuns.jobKey,
      status: jobRuns.status,
      detail: jobRuns.detail,
      finishedAt: jobRuns.finishedAt,
    })
    .from(jobRuns)
    .where(and(eq(jobRuns.runDate, "1970-01-01"), inArray(jobRuns.jobKey, all)));
  const result: CoverageSocialRecord[] = [];
  for (const [id, identities] of keys) {
    const seen = new Set<string>();
    for (const row of rows.filter((r) => identities.includes(r.jobKey))) {
      let confirmed: { postId: string; storyIds: number[] } | undefined;
      if (row.status === "success" && row.finishedAt && row.detail && row.detail.length <= 8192) {
        try {
          const parsed = receipt.safeParse(JSON.parse(row.detail));
          if (parsed.success && parsed.data.storyIds.includes(id)) confirmed = parsed.data;
        } catch {
          /* Unknown outcomes are not permission to publish again. */
        }
      }
      const key = confirmed?.postId ?? "uncertain";
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        feedItemId: id,
        state: confirmed ? "confirmed" : "reserved-or-uncertain",
        mediaId: confirmed?.postId ?? null,
        confirmedAt: confirmed ? row.finishedAt!.toISOString() : null,
      });
    }
  }
  return result;
}
