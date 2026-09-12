import { sql } from "drizzle-orm";
import { EVIDENCE_SOURCES, type EvidenceSource } from "../../scripts/ingest/propertySources";
import { fetchSourceReport } from "../../scripts/ingest/lib/rss";
import { getDb } from "../db/client";
import { evidenceSourceStatus, propertyEvidence } from "../db/evidenceSchema";
import { normaliseEvidence } from "./normalize";
import { collectionSignal, withCollectionWrite } from "../db/collectionRuns";

/** Bounded I/O, no model calls and no publication/social/email side effects. */
export async function collectPropertyEvidence(sources: EvidenceSource[] = EVIDENCE_SOURCES) {
  const db = getDb();
  if (!db) throw new Error("Evidence collection requires a database");
  let failures = 0;
  const failedSources: Array<{ name: string; reason: string }> = [];
  for (let start = 0; start < sources.length; start += 6) {
    collectionSignal()?.throwIfAborted();
    await Promise.all(
      sources.slice(start, start + 6).map(async (source) => {
        let report = await fetchSourceReport(source);
        if (report.error) report = await fetchSourceReport(source);
        const checkedAt = report.checkedAt ?? new Date();
        const rows = report.items.flatMap((item) => {
          const row = normaliseEvidence(item, checkedAt);
          return row ? [row] : [];
        });
        // Duplicate URLs in one feed must not inflate accepted counts.
        const unique = [...new Map(rows.map((row) => [row.identity, row])).values()];
        await withCollectionWrite(async (db) => {
          if (unique.length)
            await db
              .insert(propertyEvidence)
              .values(unique)
              .onDuplicateKeyUpdate({
                set: { lastSeenAt: checkedAt },
              });
          const newestPublishedAt = unique.reduce<Date | null>(
            (date, row) => (!date || row.publishedAt > date ? row.publishedAt : date),
            null
          );
          const status = {
            sourceId: source.id,
            checkedAt,
            fetched: report.fetched,
            accepted: unique.length,
            newestPublishedAt,
            error: report.error,
          };
          await db
            .insert(evidenceSourceStatus)
            .values({
              ...status,
              lastSuccessAt: report.error ? null : checkedAt,
            })
            .onDuplicateKeyUpdate({
              set: {
                ...status,
                lastSuccessAt: report.error
                  ? sql`${evidenceSourceStatus.lastSuccessAt}`
                  : checkedAt,
              },
            });
        });
        if (report.error) {
          failures++;
          failedSources.push({ name: source.name, reason: report.error });
        }
      })
    );
  }
  if (failedSources.length) console.warn(`[evidence-failures] ${JSON.stringify(failedSources)}`);
  if (failures === sources.length) throw new Error("All property evidence sources failed");
  console.log(
    `[evidence] checked ${sources.length} sources; ${failures} failed (see Admin coverage)`
  );
  return { checked: sources.length, failed: failures };
}
