import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { propertyEvidence } from "./evidenceSchema";

/** Preserve the archive and remove the audited wrong-country classification. */
export async function applyReviewedEvidenceCorrection() {
  const db = getDb();
  if (!db) return;
  await db
    .update(propertyEvidence)
    .set({ regions: [] })
    .where(
      and(
        eq(propertyEvidence.id, 287372),
        sql`CAST(${propertyEvidence.title} AS BINARY) = CAST(${"Builder defends controversial Newcastle housing plans after row over council land deal"} AS BINARY)`,
        eq(propertyEvidence.source, "Yahoo News UK"),
        sql`JSON_LENGTH(${propertyEvidence.regions}) = 1 AND JSON_CONTAINS(${propertyEvidence.regions}, ${JSON.stringify("NSW")})`
      )
    );
}
