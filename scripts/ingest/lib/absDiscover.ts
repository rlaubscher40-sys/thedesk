/**
 * Finding an ABS dataflow without anybody pasting an identifier in.
 *
 * The migration to the API left one manual step: read the flow reference off
 * the catalogue and put it in the config. That is a step nobody should have to
 * take, so this does it at ingest time instead — search the catalogue, pick the
 * best match, and prove it before using it.
 *
 * ## The danger, and what makes it safe
 *
 * Automatic discovery has a failure mode that hand-configuration does not: a
 * wrong-but-valid flow. A missing flow fails loudly and falls back to the
 * scrape; a flow that returns perfectly good numbers *for the wrong series*
 * would quietly publish wrong figures under a right-looking label. On a
 * publication whose whole position is that its numbers are checkable, that is
 * the worst available outcome — worse than not having the metric.
 *
 * So a candidate is only accepted if it passes all of:
 *
 *   1. Its name matches the search terms well enough to beat every other flow.
 *   2. It actually returns observations.
 *   3. Its latest value lands inside a range the caller declares up front.
 *
 * Check 3 is the one that matters. "Unemployment is between 2 and 15 per cent"
 * is a thing we know independently of the API, and it is what separates the
 * right series from a plausible-looking neighbour. A metric with no honest
 * range should not use discovery.
 */
import { fetchAbsSeries, latestObservation } from "./absApi";

export type Dataflow = { id: string; agency: string; version: string; name: string };

export type DiscoverSpec = {
  /** Words that should appear in the flow's name, most distinctive first. */
  terms: string[];
  /** Words that, if present, mean this is the wrong flow. */
  exclude?: string[];
  /**
   * The range the latest value must fall in. Required: discovery without a
   * plausibility check can accept a wrong series that happens to parse.
   */
  expectRange: [number, number];
  dataKey?: string;
  startPeriod?: string;
};

/**
 * Score a flow's name against the search terms.
 *
 * Earlier terms are weighted higher because the caller lists the most
 * distinctive word first, and a flow matching "migration" matters more than one
 * matching "australia". An excluded word zeroes the score outright rather than
 * merely lowering it: it is a statement that this is the wrong flow, not that
 * it is a weaker one.
 */
export function scoreFlow(flow: Dataflow, spec: DiscoverSpec): number {
  const name = `${flow.name} ${flow.id}`.toLowerCase();
  for (const bad of spec.exclude ?? []) {
    if (name.includes(bad.toLowerCase())) return 0;
  }
  let score = 0;
  spec.terms.forEach((term, i) => {
    if (name.includes(term.toLowerCase())) score += spec.terms.length - i;
  });
  return score;
}

/** Flows that matched at all, best first. Ties break on the shorter name, which
 *  is a decent proxy for the headline series rather than a niche cut of it. */
export function rankFlows(flows: Dataflow[], spec: DiscoverSpec): Dataflow[] {
  return flows
    .map((flow) => ({ flow, score: scoreFlow(flow, spec) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.flow.name.length - b.flow.name.length)
    .map((c) => c.flow);
}

/** Is this value the sort of number this metric should be? */
export function withinExpected(value: number, [min, max]: [number, number]): boolean {
  return value >= min && value <= max;
}

export type ResolvedFlow = { flowRef: string; latest: number; period: string };

/**
 * Try each candidate in order until one returns data whose latest value is
 * plausible. Returns null when none does, which the caller treats as "keep
 * scraping" rather than as an error.
 *
 * `maxCandidates` bounds the work: a search that matches thirty flows is a
 * badly specified search, and trying all thirty would turn one metric into
 * thirty API calls on every run.
 */
export async function resolveFlow(
  flows: Dataflow[],
  spec: DiscoverSpec,
  maxCandidates = 4
): Promise<ResolvedFlow | null> {
  for (const flow of rankFlows(flows, spec).slice(0, maxCandidates)) {
    const flowRef = `${flow.agency},${flow.id},${flow.version}`;
    const result = await fetchAbsSeries({
      flowRef,
      dataKey: spec.dataKey,
      startPeriod: spec.startPeriod,
    });
    if (!result.ok) continue;
    const latest = latestObservation(result.observations);
    if (!latest) continue;
    if (!withinExpected(latest.value, spec.expectRange)) {
      console.warn(
        `[abs] ${flowRef} matched "${spec.terms[0]}" but its latest value ${latest.value} is outside the expected range ${spec.expectRange.join("..")}; not using it.`
      );
      continue;
    }
    console.log(
      `[abs] resolved "${spec.terms[0]}" to ${flowRef} (${latest.period} = ${latest.value})`
    );
    return { flowRef, latest: latest.value, period: latest.period };
  }
  return null;
}
