import { and, eq, sql } from "drizzle-orm";
import { correctReviewedEditionText } from "../../shared/reviewedEditionCorrection";
import { getDb } from "./client";
import { editions } from "./schema";

export async function applyReviewedEditionCorrection() {
  const db = getDb();
  if (!db) return;
  const [row] = await db
    .select({
      id: editions.id,
      topics: editions.topics,
      fullText: editions.fullText,
      rubensTake: editions.rubensTake,
      lookback: editions.lookback,
      datesToWatch: editions.datesToWatch,
    })
    .from(editions)
    .where(and(eq(editions.editionNumber, 17), eq(editions.weekOf, "2026-09-07")))
    .limit(1);
  if (!row) return;
  for (const field of ["topics", "fullText", "rubensTake", "lookback", "datesToWatch"] as const) {
    const before = row[field],
      after = correctReviewedEditionText(before);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const json = ["topics", "lookback", "datesToWatch"].includes(field);
    await db
      .update(editions)
      .set({ [field]: after })
      .where(
        and(
          eq(editions.id, row.id),
          eq(editions.editionNumber, 17),
          eq(editions.weekOf, "2026-09-07"),
          json
            ? sql`${editions[field]} = CAST(${JSON.stringify(before)} AS JSON)`
            : sql`CAST(${editions[field]} AS BINARY) = CAST(${before as string} AS BINARY)`
        )
      );
  }
}
