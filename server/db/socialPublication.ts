import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import { jobRuns } from "./schema";
import { isDemoMode } from "../demo/store";

// Permanent namespace: a new Sydney date must not reset story identity.
const DATE = "1970-01-01";
function database() {
  const db = getDb();
  if (!db || isDemoMode()) throw new Error("Durable social publication records unavailable");
  return db;
}
export async function readSocialRecords(keys: string[]) {
  if (!keys.length) return [];
  return database()
    .select()
    .from(jobRuns)
    .where(and(inArray(jobRuns.jobKey, keys), eq(jobRuns.runDate, DATE)));
}
/** One transaction or no reservation. Any duplicate/race/outage fails closed. */
export async function reserveSocialRecords(keys: string[]) {
  const unique = [...new Set(keys)].sort();
  if (!unique.length || unique.some((key) => !/^ig-(news|slot)-[a-f0-9]{56}$/.test(key)))
    throw new Error("Invalid social publication identity");
  await database().transaction(async (tx) => {
    await tx.insert(jobRuns).values(
      unique.map((jobKey) => ({
        jobKey,
        runDate: DATE,
        status: "running",
        attempts: 1,
        detail: "Publication reserved; outcome may be unknown. Do not retry.",
      }))
    );
  });
}
export async function confirmSocialRecords(keys: string[], receipt: string) {
  await database()
    .update(jobRuns)
    .set({ status: "success", detail: receipt, finishedAt: new Date() })
    .where(
      and(inArray(jobRuns.jobKey, keys), eq(jobRuns.runDate, DATE), eq(jobRuns.status, "running"))
    );
}
