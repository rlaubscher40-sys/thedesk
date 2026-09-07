/**
 * Explore the ABS Data API: find dataflow identifiers, then check a series.
 *
 * This exists because dataflow identifiers cannot be written from memory. A
 * wrong one fails exactly like a wrong regex, so they get read off the
 * catalogue rather than guessed, and the result is pasted into the ingest
 * config. That is the whole remaining step in moving ABS metrics off scraping.
 *
 *   pnpm probe:abs                      list dataflows
 *   pnpm probe:abs migration            list dataflows matching a word
 *   pnpm probe:abs --flow "ABS,X,1.0.0" fetch that flow and show what it holds
 *
 * The second form is the one to start with. Search for "migration", "building
 * approvals", "consumer price", "labour force", "wage price"; take the id from
 * the output; then re-run with --flow to see the dimensions, the period range
 * and the latest observations before wiring anything in.
 */
import {
  absDataflowUrl,
  absDataUrl,
  fetchAbsSeries,
  latestObservation,
  sortByPeriod,
} from "./lib/absApi";

const UA = "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)";

type Dataflow = { id: string; agency: string; version: string; name: string };

/**
 * Pull id/name pairs out of the catalogue.
 *
 * Deliberately structure-tolerant: the catalogue is SDMX-JSON and its exact
 * nesting is a detail worth not depending on, so this walks the tree for
 * anything that looks like a dataflow rather than asserting a shape it has
 * never seen respond.
 */
function collectDataflows(node: unknown, out: Dataflow[] = []): Dataflow[] {
  if (Array.isArray(node)) {
    for (const child of node) collectDataflows(child, out);
    return out;
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.id === "string" && (typeof o.name === "string" || typeof o.names === "object")) {
      const name =
        typeof o.name === "string"
          ? o.name
          : ((o.names as Record<string, string> | undefined)?.en ?? "");
      if (name) {
        out.push({
          id: o.id,
          agency: typeof o.agencyID === "string" ? o.agencyID : "ABS",
          version: typeof o.version === "string" ? o.version : "1.0.0",
          name,
        });
      }
    }
    for (const child of Object.values(o)) collectDataflows(child, out);
  }
  return out;
}

async function listDataflows(filter: string | undefined): Promise<void> {
  const url = absDataflowUrl();
  console.log(`[probe] fetching the dataflow catalogue\n  ${url}\n`);
  let json: unknown;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) {
      console.error(`[probe] ${res.status} ${res.statusText} — no catalogue to read.`);
      process.exitCode = 1;
      return;
    }
    json = await res.json();
  } catch (err) {
    console.error(`[probe] fetch failed: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const all = collectDataflows(json);
  // The same flow can appear more than once as the tree is walked.
  const seen = new Set<string>();
  const flows = all.filter((f) => {
    const key = `${f.agency},${f.id},${f.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const needle = filter?.toLowerCase();
  const matched = needle
    ? flows.filter(
        (f) => f.name.toLowerCase().includes(needle) || f.id.toLowerCase().includes(needle)
      )
    : flows;

  console.log(
    `[probe] ${flows.length} dataflows, ${matched.length} matching${filter ? ` "${filter}"` : ""}\n`
  );
  for (const f of matched.slice(0, 60)) {
    console.log(`  ${f.agency},${f.id},${f.version}`);
    console.log(`      ${f.name}`);
  }
  if (matched.length > 60)
    console.log(`\n  ...and ${matched.length - 60} more. Narrow the search.`);
  console.log(`\n[probe] next: pnpm probe:abs --flow "<the id above>"`);
}

async function inspectFlow(flowRef: string): Promise<void> {
  console.log(`[probe] fetching ${flowRef}\n  ${absDataUrl({ flowRef, startPeriod: "2000" })}\n`);
  const result = await fetchAbsSeries({ flowRef, startPeriod: "2000" });
  if (!result.ok) {
    console.error(`[probe] failed: ${result.error}`);
    console.error(
      "[probe] a 404 usually means the flow reference is wrong. Run the search form first."
    );
    process.exitCode = 1;
    return;
  }

  const rows = sortByPeriod(result.observations);
  const dimensionNames = [...new Set(rows.flatMap((r) => Object.keys(r.dimensions)))];
  const periods = [...new Set(rows.map((r) => r.period))];

  console.log(`[probe] ${rows.length} observations`);
  console.log(`[probe] dimensions: ${dimensionNames.join(", ")}`);
  console.log(
    `[probe] periods: ${periods[0]} .. ${periods[periods.length - 1]} (${periods.length})`
  );

  // The reason to prefer the API: how much history arrives in one request.
  console.log(
    `\n[probe] that is ${periods.length} periods of history in one call. The monthly review ranks a month against this.`
  );

  for (const name of dimensionNames) {
    const values = [...new Set(rows.map((r) => r.dimensions[name]).filter(Boolean))];
    if (values.length <= 12) {
      console.log(`  ${name}: ${values.join(", ")}`);
    } else {
      console.log(`  ${name}: ${values.length} distinct values`);
    }
  }

  const latest = latestObservation(rows);
  console.log(`\n[probe] latest observation: ${latest?.period} = ${latest?.value}`);
  console.log("[probe] last 5 rows:");
  for (const r of rows.slice(-5)) {
    const dims = Object.entries(r.dimensions)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(`  ${r.period.padEnd(10)} ${String(r.value).padStart(14)}   ${dims}`);
  }
  console.log(
    "\n[probe] check these against the ABS Data Explorer before wiring the flow into the ingest."
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flowIdx = args.indexOf("--flow");
  if (flowIdx !== -1) {
    const flowRef = args[flowIdx + 1];
    if (!flowRef) {
      console.error('[probe] --flow needs a reference, e.g. --flow "ABS,ABS_FLOW,1.0.0"');
      process.exitCode = 1;
      return;
    }
    await inspectFlow(flowRef);
    return;
  }
  await listDataflows(args[0]);
}

void main();
