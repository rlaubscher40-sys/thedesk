import { and, desc, eq } from "drizzle-orm";
import type { NswPlanningRecord, NswPlanningSnapshot } from "../../shared/nswPlanning";
import type { PlanningVintage } from "../../shared/projectFollowThrough";
import { getDb } from "./client";
import { planningSnapshots } from "./schema";
export async function readPlanningSnapshots(
  councilName: string,
  from: string,
  to: string,
  fingerprint?: string
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
  await db.insert(planningSnapshots).values({
    councilName: snapshot.councilName,
    periodFrom: snapshot.from,
    periodTo: snapshot.to,
    fingerprint: snapshot.fingerprint,
    snapshot,
    records,
  });
}

/**
 * The retained per-application records of recent reads of one council month.
 *
 * Follow-through needs the records, not the aggregate, and it needs several
 * vintages rather than the latest one. Nothing new is fetched or stored here:
 * these rows were already written by the pilot read.
 */
export async function readPlanningVintages(
  councilName: string,
  from: string,
  to: string,
  limit: number
): Promise<PlanningVintage[]> {
  const db = getDb();
  if (!db) throw new Error("Planning snapshot storage unavailable");
  const rows = await db
    .select({
      fingerprint: planningSnapshots.fingerprint,
      snapshot: planningSnapshots.snapshot,
      records: planningSnapshots.records,
    })
    .from(planningSnapshots)
    .where(
      and(
        eq(planningSnapshots.councilName, councilName),
        eq(planningSnapshots.periodFrom, from),
        eq(planningSnapshots.periodTo, to)
      )
    )
    .orderBy(desc(planningSnapshots.id))
    .limit(Math.max(1, Math.min(60, Math.trunc(limit))));
  return rows
    .filter((row) => row.snapshot?.completePagination === true && Array.isArray(row.records))
    .map((row) => ({
      retrievedAt: row.snapshot.retrievedAt,
      fingerprint: row.fingerprint,
      records: row.records,
    }));
}
