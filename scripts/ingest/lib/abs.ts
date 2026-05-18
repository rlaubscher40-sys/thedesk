/**
 * ABS latest-release page scraper. Each ABS indicator publishes a stable
 * URL at `/statistics/.../latest-release` whose "Key statistics" section
 * carries the headline figure inside a predictable HTML pattern.
 *
 * We don't try to handle the full SDMX API — these pages have stayed
 * structurally consistent for years and the headline number is what
 * matters. If a regex fails for one indicator the others still run.
 *
 * Each fetched value is paired with its `asOf` timestamp (best effort —
 * we use the page's "released" date when we can find it, otherwise the
 * current run timestamp).
 */

const UA =
  "Mozilla/5.0 (compatible; TheDeskBot/1.0; +https://thedesk.au)";

export type AbsResult = {
  metricKey: string;
  label: string;
  value: string;
  unit: string;
  context: string | null;
  groupKey: string;
  source: string;
  asOf: Date;
  displayOrder: number;
} | null;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (!res.ok) {
      console.warn(`[abs] ${url} → ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[abs] ${url} error: ${(err as Error).message}`);
    return null;
  }
}

/** Best-effort: pull the "Reference period" date from the page header. */
function findReferenceDate(html: string): Date {
  const m =
    html.match(/Reference period[^<]*<[^>]*>\s*([A-Za-z]+ \d{4})/i) ||
    html.match(/Released[^<]*<[^>]*>\s*(\d{1,2} [A-Za-z]+ \d{4})/i);
  if (m && m[1]) {
    const d = new Date(m[1]);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Generic helper. Fetch the page; run each pattern in order until one
 * matches; coerce to a number; return the row.
 */
async function scrapeAbs(args: {
  url: string;
  metricKey: string;
  label: string;
  unit: string;
  context: string | null;
  groupKey: string;
  displayOrder: number;
  patterns: RegExp[];
}): Promise<AbsResult> {
  const html = await fetchHtml(args.url);
  if (!html) return null;
  for (const re of args.patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const raw = m[1].replace(/[,\s]/g, "");
      const num = Number(raw);
      if (Number.isFinite(num)) {
        return {
          metricKey: args.metricKey,
          label: args.label,
          value: m[1].trim(),
          unit: args.unit,
          context: args.context,
          groupKey: args.groupKey,
          source: "ABS",
          asOf: findReferenceDate(html),
          displayOrder: args.displayOrder,
        };
      }
    }
  }
  console.warn(`[abs] no pattern matched for ${args.metricKey}`);
  return null;
}

export async function fetchCpiTrimmedMean(): Promise<AbsResult> {
  return scrapeAbs({
    url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release",
    metricKey: "cpi_trimmed",
    label: "Trimmed mean CPI",
    unit: "%",
    context: "ABS quarterly",
    groupKey: "MACRO",
    displayOrder: 20,
    patterns: [
      /[Tt]rimmed mean[^0-9%]{0,200}?([0-9]+(?:\.[0-9]+)?)\s*%/,
      /Annual trimmed mean[^0-9]{0,200}?([0-9]+(?:\.[0-9]+)?)/,
    ],
  });
}

export async function fetchUnemploymentRate(): Promise<AbsResult> {
  return scrapeAbs({
    url: "https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release",
    metricKey: "unemployment",
    label: "Unemployment rate",
    unit: "%",
    context: "ABS seasonally adjusted",
    groupKey: "LABOUR",
    displayOrder: 70,
    patterns: [
      /[Uu]nemployment rate[^0-9%]{0,200}?([0-9]+(?:\.[0-9]+)?)\s*%/,
      /[Uu]nemployment[^0-9%]{0,80}?([0-9]+\.[0-9])\s*per cent/,
    ],
  });
}

export async function fetchWageGrowth(): Promise<AbsResult> {
  return scrapeAbs({
    url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/wage-price-index-australia/latest-release",
    metricKey: "wage_growth",
    label: "Wage growth (WPI)",
    unit: "%",
    context: "ABS quarterly",
    groupKey: "LABOUR",
    displayOrder: 80,
    patterns: [
      /[Ww]age [Pp]rice [Ii]ndex[^0-9%]{0,300}?([0-9]+(?:\.[0-9]+)?)\s*%/,
      /[Aa]nnual[^0-9%]{0,200}?([0-9]+(?:\.[0-9]+)?)\s*%/,
    ],
  });
}

export async function fetchBuildingApprovals(): Promise<AbsResult> {
  return scrapeAbs({
    url: "https://www.abs.gov.au/statistics/industry/building-and-construction/building-approvals-australia/latest-release",
    metricKey: "building_approvals",
    label: "Building approvals",
    unit: "",
    context: "ABS monthly · total dwellings",
    groupKey: "PROPERTY",
    displayOrder: 60,
    patterns: [
      /[Tt]otal dwellings[^0-9]{0,200}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})/,
      /[Dd]welling units approved[^0-9]{0,200}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})/,
    ],
  });
}

export async function fetchNetMigration(): Promise<AbsResult> {
  return scrapeAbs({
    url: "https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/latest-release",
    metricKey: "net_migration",
    label: "Net migration",
    unit: "",
    context: "ABS quarterly · NOM",
    groupKey: "DEMOGRAPHICS",
    displayOrder: 120,
    patterns: [
      /[Nn]et overseas migration[^0-9]{0,300}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})/,
      /[Nn]et migration[^0-9]{0,200}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,})/,
    ],
  });
}

export async function fetchAllAbs(): Promise<AbsResult[]> {
  return Promise.all([
    fetchCpiTrimmedMean(),
    fetchUnemploymentRate(),
    fetchWageGrowth(),
    fetchBuildingApprovals(),
    fetchNetMigration(),
  ]);
}
