import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { jobRuns } from "../db/schema";

export async function reelPublicationStatus(publication: {
  key: string;
  date: string;
}): Promise<"available" | "locked" | "unavailable"> {
  const db = getDb();
  if (!db) return "unavailable";
  try {
    const rows = await db
      .select({ status: jobRuns.status })
      .from(jobRuns)
      .where(and(eq(jobRuns.jobKey, publication.key), eq(jobRuns.runDate, publication.date)))
      .limit(1);
    return rows.length ? "locked" : "available";
  } catch {
    return "unavailable";
  }
}
