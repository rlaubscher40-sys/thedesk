/**
 * Project follow-through read and cohort refresh.
 *
 * The pilot on Signals reads one council month on demand and retains an
 * immutable dated vintage of it. This module reads those retained vintages back
 * and follows individual applications across them, and it keeps three complete
 * earlier months alive with a weekly re-read so a cohort keeps being followed
 * after its month rolls out of the pilot window.
 *
 * Deliberately not here: any new source, any public parameter that could turn
 * this into an API proxy, and any estimate. A period with no retained vintage is
 * unavailable, not empty.
 */
import { cached } from "../core/cache";
import { isDemoMode } from "../demo/store";
import { readPlanningVintages, savePlanningSnapshot } from "../db/planningSnapshots";
import { NSW_PILOT_COUNCIL, planningPeriodWindow } from "../../shared/nswPlanning";
import {
  buildProjectFollowThrough,
  followThroughPeriods,
  followThroughUpdates,
  selectFollowThroughCohort,
  type FollowThroughUpdate,
  type PlanningVintage,
  type ProjectFollowThrough,
} from "../../shared/projectFollowThrough";
import { fetchNswPlanningSnapshot } from "./nswDa";

/** Small enough to stay verifiable by hand, large enough to be a cohort. */
const FOLLOW_THROUGH_COHORT_SIZE = 12;
/** Enough vintages to show a timeline; bounded so one read cannot pull a year of JSON. */
const MAX_VINTAGES = 24;

export type FollowThroughRead = {
  status: "available" | "unavailable";
  councilName: string;
  period: string | null;
  cohort: ProjectFollowThrough[];
  updates: FollowThroughUpdate[];
  /** Reads of this period that The Desk is following through on. */
  checks: number;
  lastCheckedAt: string | null;
};

const unavailable: FollowThroughRead = {
  status: "unavailable",
  councilName: NSW_PILOT_COUNCIL,
  period: null,
  cohort: [],
  updates: [],
  checks: 0,
  lastCheckedAt: null,
};

function assemble(period: string, vintages: PlanningVintage[]): FollowThroughRead | null {
  const newest = vintages
    .slice()
    .sort((a, b) => Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt))[0];
  if (!newest) return null;
  const cohort = selectFollowThroughCohort(newest.records, FOLLOW_THROUGH_COHORT_SIZE)
    .map((projectId) => buildProjectFollowThrough(projectId, vintages))
    .filter((project): project is ProjectFollowThrough => project !== null);
  if (cohort.length === 0) return null;
  return {
    status: "available",
    councilName: NSW_PILOT_COUNCIL,
    period,
    cohort,
    updates: followThroughUpdates(cohort),
    checks: vintages.length,
    lastCheckedAt: newest.retrievedAt,
  };
}

/**
 * The most recent tracked month that has retained vintages. Older months are
 * tried in turn so a quiet month does not hide a cohort that is being followed.
 */
export async function getProjectFollowThrough(now = new Date()): Promise<FollowThroughRead> {
  if (isDemoMode()) return unavailable;
  return cached("nsw:planning:followthrough", 15 * 60_000, async () => {
    for (const period of followThroughPeriods(now)) {
      const window = planningPeriodWindow(period);
      if (!window) continue;
      try {
        const vintages = await readPlanningVintages(
          NSW_PILOT_COUNCIL,
          window.from,
          window.to,
          MAX_VINTAGES
        );
        const read = assemble(period, vintages);
        if (read) return read;
      } catch {
        // Storage failure is unavailable, never a partial or invented cohort.
        console.warn(`[planning] follow-through unavailable for ${period}`);
        return unavailable;
      }
    }
    return unavailable;
  });
}

export type CohortRefreshResult = { period: string; state: "saved" | "failed" | "skipped" };

/**
 * Re-read the tracked months so the cohort keeps accumulating dated evidence.
 *
 * Runs against the same fixed council and whole-month windows the pilot already
 * uses, so it adds three reads a week to a source that publishes daily. A period
 * that fails is reported and skipped; it never writes a partial vintage, because
 * `fetchNswPlanningSnapshot` already refuses an incomplete read.
 */
export async function refreshProjectFollowThrough(
  now = new Date()
): Promise<CohortRefreshResult[]> {
  if (isDemoMode()) return [];
  const results: CohortRefreshResult[] = [];
  for (const period of followThroughPeriods(now)) {
    const window = planningPeriodWindow(period);
    if (!window) {
      results.push({ period, state: "skipped" });
      continue;
    }
    try {
      const { snapshot, records } = await fetchNswPlanningSnapshot({
        councilName: NSW_PILOT_COUNCIL,
        ...window,
      });
      await savePlanningSnapshot(snapshot, records);
      results.push({ period, state: "saved" });
    } catch {
      console.warn(`[planning] follow-through refresh failed for ${period}`);
      results.push({ period, state: "failed" });
    }
  }
  console.log(`[planning] follow-through refresh ${JSON.stringify(results)}`);
  return results;
}
