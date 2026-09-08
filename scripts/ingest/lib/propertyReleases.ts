import type { MetricOut } from "../dailyMetrics";
import {
  MONTHS,
  requireRecent,
  sourceDate,
  sourceHtml,
} from "./publishedSources";
import { fetchMortgageArrears } from "./mortgageArrears";

export function parseSentiment(html: string, now = new Date()) {
  const date = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
  // The public publisher description repeats the headline index. Do not select
  // the percentage change, an expectations sub-index or a previous month.
  const sentence = html.match(
    /Westpac[–—-]Melbourne Institute Consumer Sentiment Index\s+(?:rose|fell|declined|increased|decreased|lifted|dropped|was|remained)[^<>"]{0,100}?(?:to|at)\s+(\d{2,3}\.\d+)\s+in\s+([A-Za-z]+)/i,
  );
  if (!date || !sentence)
    throw new Error("Headline Westpac-MI index and publication date not found");
  const month = MONTHS.findIndex(
    (m) => m.toLowerCase() === sentence[2]!.slice(0, 3).toLowerCase(),
  );
  const published = new Date(date[1]!);
  if (month < 0 || month !== published.getUTCMonth())
    throw new Error("Sentiment month does not match release date");
  requireRecent(date[1]!, 75, now);
  const value = Number(sentence[1]);
  if (value < 20 || value > 180) throw new Error("Invalid sentiment index");
  return {
    value: value.toFixed(1),
    asOf: sourceDate("1", sentence[2]!, String(published.getUTCFullYear())),
  };
}

async function sentiment(): Promise<MetricOut> {
  const index = await sourceHtml("https://www.westpaciq.com.au/economics");
  const paths = [
    ...new Set(
      index.match(
        /\/economics\/\d{4}\/\d{2}\/consumer-sentiment-[a-z]+-\d{4}/g,
      ) ?? [],
    ),
  ]
    .sort()
    .reverse();
  if (!paths.length)
    throw new Error("Westpac sentiment release link not found");
  const url = `https://www.westpaciq.com.au${paths[0]}`;
  return {
    metricKey: "consumer_confidence",
    label: "Consumer sentiment",
    ...parseSentiment(await sourceHtml(url)),
    source: "Westpac–Melbourne Institute",
    sourceUrl: url,
    groupKey: "MACRO",
    displayOrder: 30,
    context:
      "Australia, monthly Westpac–Melbourne Institute headline index. 100 is neutral; below 100 indicates more pessimists than optimists.",
  };
}

export function parseDwellingTable(html: string, now = new Date()) {
  const match = html.match(
    /window\.infographicData\s*=\s*([\s\S]*?);\s*<\/script>/,
  );
  if (!match) throw new Error("Cotality published table data not found");
  const data = JSON.parse(match[1]!) as { title?: string };
  const period = data.title?.match(
    /^(\d{2})(\d{2}) HVI [A-Za-z]+ \(([A-Za-z]+) data\) WEB$/,
  );
  if (!period) throw new Error("HVI reporting period not found");
  const releaseMonth = Number(period[2]);
  const reportMonth = MONTHS.findIndex(
    (m) => m.toLowerCase() === period[3]!.slice(0, 3).toLowerCase(),
  );
  if (reportMonth < 0 || reportMonth !== (releaseMonth + 10) % 12)
    throw new Error("HVI period mismatch");
  const year = 2000 + Number(period[1]) - (releaseMonth === 1 ? 1 : 0);
  const asOf = new Date(Date.UTC(year, reportMonth + 1, 0))
    .toISOString()
    .slice(0, 10);
  requireRecent(asOf, 75, now);
  const values = new Set<string>();
  // Locate the labelled column in a table; never infer the final cell's meaning.
  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      const cell = (v: unknown) =>
        typeof v === "object" && v !== null && "value" in v
          ? String(v.value).trim()
          : "";
      const header = node.find(
        (row) =>
          Array.isArray(row) && row.some((c) => cell(c) === "Median value"),
      );
      if (Array.isArray(header)) {
        const col = header.findIndex((c) => cell(c) === "Median value");
        for (const row of node)
          if (Array.isArray(row) && cell(row[0]) === "National") {
            const raw = cell(row[col]);
            if (!/^\$\d{1,3}(?:,\d{3})+$/.test(raw))
              throw new Error("Invalid national median value");
            values.add(raw);
          }
      }
      node.forEach(visit);
    } else if (node && typeof node === "object")
      Object.values(node).forEach(visit);
  }
  visit(data);
  if (values.size !== 1)
    throw new Error("Missing or ambiguous national median dwelling value");
  return { value: [...values][0]!, asOf };
}

async function dwelling(): Promise<MetricOut> {
  const index = await sourceHtml(
    "https://www.cotality.com/au/insights/all-insights",
  );
  const paths = [
    ...new Set(
      [
        ...index.matchAll(/href="([^"]*\/au\/insights\/articles\/[^"?#]+)"/g),
      ].map((m) => m[1]!),
    ),
  ]
    .filter((path) => /housing|home-value|value-fall/.test(path))
    .slice(0, 4);
  const candidates = await Promise.all(
    paths.map(async (path) => {
      try {
        const url = new URL(path, "https://www.cotality.com").href;
        const article = await sourceHtml(url);
        const embeds = [
          ...article.matchAll(
            /(?:infogram_0_|data-id="|https:\/\/e\.infogram\.com\/)([a-f0-9-]{36})/g,
          ),
        ].map((m) => m[1]!);
        for (const id of [...new Set(embeds)].slice(0, 2)) {
          try {
            return {
              ...parseDwellingTable(
                await sourceHtml(`https://e.infogram.com/${id}`),
              ),
              url,
            };
          } catch {
            /* The article may embed a different chart before its HVI table. */
          }
        }
      } catch {
        /* Other current articles may contain the monthly table. */
      }
      return null;
    }),
  );
  const latest = candidates
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
  if (!latest)
    throw new Error("Current Cotality national median table unavailable");
  return {
    metricKey: "dwelling_value",
    label: "National median dwelling value",
    value: latest.value,
    asOf: latest.asOf,
    source: "Cotality HVI",
    sourceUrl: latest.url,
    groupKey: "PROPERTY",
    displayOrder: 40,
    context:
      "Australia, median dwelling value in AUD. Monthly Home Value Index table; includes capital cities and regional markets.",
  };
}

export async function fetchPropertyReleaseMetrics(
  onError?: (key: string, reason: string) => void,
): Promise<MetricOut[]> {
  const tasks = [
    ["consumer_confidence", sentiment],
    ["dwelling_value", dwelling],
    ["mortgage_arrears", fetchMortgageArrears],
  ] as const;
  const results = await Promise.all(
    tasks.map(async ([key, collect]) => {
      try {
        return await collect();
      } catch (error) {
        onError?.(key, (error as Error).message);
        return null;
      }
    }),
  );
  return results.filter((row): row is MetricOut => row !== null);
}
