import { HOUSING_TOPIC_PATTERN } from "../../shared/marketRelevance";
import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { getDb } from "./client";
import { evidenceSourceStatus, propertyEvidence } from "./evidenceSchema";
import { escapeLike } from "./like";
import { isDemoMode } from "../demo/store";
import { EVIDENCE_SOURCES } from "../../scripts/ingest/propertySources";
import { PROPERTY_REGIONS, sourceHealth } from "../../shared/propertyCoverage";

export async function searchPropertyEvidence(query: string, limit = 40) {
  const db = getDb();
  if (!db || isDemoMode()) return [];
  const pattern = `%${escapeLike(query.trim())}%`;
  if (!query.trim()) return [];
  return db
    .select()
    .from(propertyEvidence)
    .where(
      and(
        or(like(propertyEvidence.title, pattern), like(propertyEvidence.summary, pattern)),
        gte(propertyEvidence.publishedAt, new Date(Date.now() - 180 * 86_400_000)),
        lte(propertyEvidence.publishedAt, new Date())
      )
    )
    .orderBy(desc(propertyEvidence.publishedAt))
    .limit(Math.min(limit, 50));
}

export async function getPropertyEvidence(id: number) {
  const db = getDb();
  if (!db || isDemoMode()) return null;
  return (
    (await db.select().from(propertyEvidence).where(eq(propertyEvidence.id, id)).limit(1))[0] ??
    null
  );
}

/** Separate state budgets prevent a busy east-coast news day hiding smaller states. */
export async function listPropertyMarketEvidence() {
  const db = getDb();
  if (!db || isDemoMode()) return [];
  const bundles = await Promise.all(
    PROPERTY_REGIONS.map((region) =>
      db
        .select()
        .from(propertyEvidence)
        .where(
          and(
            sql`JSON_CONTAINS(${propertyEvidence.regions}, ${JSON.stringify(region.code)})`,
            gte(propertyEvidence.publishedAt, new Date(Date.now() - 90 * 86_400_000)),
            lte(propertyEvidence.publishedAt, new Date()),
            sql`LOWER(CONCAT(${propertyEvidence.title}, ' ', ${propertyEvidence.summary})) REGEXP ${HOUSING_TOPIC_PATTERN}`
          )
        )
        .orderBy(desc(propertyEvidence.publishedAt))
        .limit(100)
    )
  );
  return [...new Map(bundles.flat().map((row) => [row.id, row])).values()];
}

export async function propertyCoverage() {
  const db = getDb();
  const now = new Date();
  const statuses = db && !isDemoMode() ? await db.select().from(evidenceSourceStatus) : [];
  const regions = await Promise.all(
    PROPERTY_REGIONS.map(async (region) => {
      const [counts] =
        db && !isDemoMode()
          ? await db
              .select({
                count: sql<number>`COUNT(*)`,
                housing: sql<number>`SUM(JSON_CONTAINS(${propertyEvidence.topics}, '"housing"'))`,
                rents: sql<number>`SUM(JSON_CONTAINS(${propertyEvidence.topics}, '"rents"'))`,
                supply: sql<number>`SUM(JSON_CONTAINS(${propertyEvidence.topics}, '"supply"'))`,
                credit: sql<number>`SUM(JSON_CONTAINS(${propertyEvidence.topics}, '"credit"'))`,
                demand: sql<number>`SUM(JSON_CONTAINS(${propertyEvidence.topics}, '"demand"'))`,
                policy: sql<number>`SUM(JSON_CONTAINS(${propertyEvidence.topics}, '"policy"'))`,
                newest: sql<string | null>`MAX(${propertyEvidence.publishedAt})`,
              })
              .from(propertyEvidence)
              .where(
                and(
                  sql`JSON_CONTAINS(${propertyEvidence.regions}, ${JSON.stringify(region.code)})`,
                  gte(propertyEvidence.publishedAt, new Date(now.getTime() - 7 * 86_400_000)),
                  lte(propertyEvidence.publishedAt, now)
                )
              )
          : [];
      return {
        code: region.code,
        name: region.name,
        articles7d: Number(counts?.count ?? 0),
        newest: counts?.newest ?? null,
        topics: {
          housing: Number(counts?.housing ?? 0),
          rents: Number(counts?.rents ?? 0),
          supply: Number(counts?.supply ?? 0),
          credit: Number(counts?.credit ?? 0),
          demand: Number(counts?.demand ?? 0),
          policy: Number(counts?.policy ?? 0),
        },
      };
    })
  );
  return {
    regions,
    sources: EVIDENCE_SOURCES.map((source) => {
      const status = statuses.find((row) => row.sourceId === source.id);
      return {
        id: source.id,
        name: source.name,
        region: source.region,
        beat: source.beat,
        state: sourceHealth(status, now),
        checkedAt: status?.checkedAt ?? null,
        lastSuccessAt: status?.lastSuccessAt ?? null,
        newestPublishedAt: status?.newestPublishedAt ?? null,
        fetched: status?.fetched ?? 0,
        accepted: status?.accepted ?? 0,
        error: status?.error ?? null,
      };
    }),
  };
}
