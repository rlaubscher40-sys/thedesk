import { and, desc, eq } from "drizzle-orm";
import type { NswPlanningRecord, NswPlanningSnapshot } from "../../shared/nswPlanning";
import { getDb } from "./client";
import { planningSnapshots } from "./schema";
export async function readPlanningSnapshots(
  councilName: string,
  from: string,
  to: string,
  fingerprint?: string,
): Promise<NswPlanningSnapshot[]> {
  const db = getDb();
  if (!db) throw new Error("Planning snapshot storage unavailable");
  const rows = await db
    .select({ snapshot: planningSnapshots.snapshot })
    .from(planningSnapshots)
    .where(
      and(
        eq(planningSnapshots.councilName, councilName),
        eq(planningSnapshots.periodFrom, from),
        eq(planningSnapshots.periodTo, to),
        ...(fingerprint ? [eq(planningSnapshots.fingerprint, fingerprint)] : [])
      )
    )
    .orderBy(desc(planningSnapshots.id))
    .limit(3);
  return rows.map((row) => row.snapshot);
}
export async function savePlanningSnapshot(
  snapshot: NswPlanningSnapshot,
  records: NswPlanningRecord[]
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Planning snapshot storage unavailable");
  await db
    .insert(planningSnapshots)
    .values({
      councilName: snapshot.councilName,
      periodFrom: snapshot.from,
      periodTo: snapshot.to,
      fingerprint: snapshot.fingerprint,
      snapshot,
      records,
    });
}
