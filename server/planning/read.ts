import { cached } from "../core/cache";
import { isDemoMode } from "../demo/store";
import { readPlanningSnapshots, savePlanningSnapshot } from "../db/planningSnapshots";
import {
  NSW_PILOT_COUNCIL,
  nswPlanningWindow,
  type NswPlanningRead,
} from "../../shared/nswPlanning";
import { fetchNswPlanningSnapshot } from "./nswDa";

/** Fixed council and month: public visitors cannot turn this into an arbitrary API proxy.
 * Single-flight caching bounds both API traffic and stored vintages. No LLM or paid API. */
export async function getNswPlanningPilot(): Promise<NswPlanningRead> {
  const window = nswPlanningWindow(new Date());
  return cached(`nsw:planning:attempt:${window.from}`, 60_000, async () => {
    if (isDemoMode()) return { status: "unavailable", snapshot: null, previous: [] };
    try {
      {
        const previous = await readPlanningSnapshots(NSW_PILOT_COUNCIL, window.from, window.to);
        const latest = previous[0];
        const age = latest ? Date.now() - Date.parse(latest.retrievedAt) : Infinity;
        if (latest && age >= 0 && age < 6 * 60 * 60_000)
          return { status: "available" as const, snapshot: latest, previous: previous.slice(1) };
        const { snapshot, records } = await fetchNswPlanningSnapshot({
          councilName: NSW_PILOT_COUNCIL,
          ...window,
        });
        // Keep immutable vintages and record identities before publishing a summary.
        await savePlanningSnapshot(snapshot, records);
        return { status: "available" as const, snapshot, previous };
      }
    } catch {
      // No partial counts, invented zeros, or silently stale fallback on source/storage errors.
      console.warn("[planning] NSW pilot unavailable; snapshot not published");
      return { status: "unavailable", snapshot: null, previous: [] };
    }
  });
}
