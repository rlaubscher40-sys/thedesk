/**
 * Probe an ABS release page and print what the per-jurisdiction extractor can
 * actually see on it.
 *
 * This exists because `scripts/ingest/lib/abs.ts` is a regex scraper against
 * someone else's HTML, and that HTML changes without telling us. The parsing in
 * `absStates.ts` is unit-tested against a fixture, which proves the logic; only
 * the live page proves the patterns. Guessing at the difference is how a metric
 * ends up silently reporting nothing for a month.
 *
 * Run it, read the output, and only wire a series into the daily ingest once
 * the figures here match what the page shows a human.
 *
 *   pnpm tsx scripts/ingest/probe-abs.ts
 *   pnpm tsx scripts/ingest/probe-abs.ts <url>
 *
 * Also useful for the recurring maintenance case: when an existing metric stops
 * reporting, point this at its page to see whether the number moved, the label
 * changed, or the page stopped carrying it at all.
 */
import {
  AU_JURISDICTIONS,
  extractStateFigures,
  flattenHtml,
  looksLikeInterstateMigration,
} from "./lib/absStates";

/** The National, state and territory population release: net overseas
 *  migration (already scraped) and net interstate migration by state (not
 *  yet) both live here. */
const DEFAULT_URL =
  "https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/latest-release";

const UA = "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)";

async function main(): Promise<void> {
  const url = process.argv[2] ?? DEFAULT_URL;
  console.log(`[probe] fetching ${url}\n`);

  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!res.ok) {
      console.error(`[probe] ${res.status} ${res.statusText} — nothing to read.`);
      process.exitCode = 1;
      return;
    }
    html = await res.text();
  } catch (err) {
    console.error(`[probe] fetch failed: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const text = flattenHtml(html);
  console.log(`[probe] ${html.length} bytes, ${text.length} after flattening\n`);

  const figures = extractStateFigures(html);
  console.log(`[probe] jurisdictions found: ${figures.length}/${AU_JURISDICTIONS.length}`);
  for (const f of figures) {
    console.log(`  ${f.code.padEnd(4)} ${String(f.value).padStart(10)}   (raw: ${f.raw})`);
  }

  const missing = AU_JURISDICTIONS.filter((j) => !figures.some((f) => f.code === j.code));
  if (missing.length) {
    console.log(`\n[probe] NOT found: ${missing.map((m) => m.code).join(", ")}`);
    // Print the surrounding text so a pattern can be written from evidence
    // rather than from a guess about the page's shape.
    for (const j of missing) {
      const at = text.indexOf(j.names[0]!);
      if (at === -1) {
        console.log(`  ${j.code}: the name "${j.names[0]}" does not appear on the page at all`);
      } else {
        console.log(`  ${j.code}: context → ...${text.slice(at, at + 200)}...`);
      }
    }
  }

  const sum = figures.reduce((n, f) => n + f.value, 0);
  console.log(`\n[probe] figures sum to ${sum}`);
  console.log(
    looksLikeInterstateMigration(figures)
      ? "[probe] balances, so this looks like net interstate migration. Safe to wire in."
      : "[probe] does NOT balance. Either this is a different column (population, NOM) or the patterns picked up the wrong cells. Do not wire this in as interstate migration."
  );
}

void main();
