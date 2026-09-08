import { getDocumentProxy } from "unpdf";
import type { MetricOut } from "../dailyMetrics";
import {
  requireRecent,
  sourceBytes,
  sourceDate,
  sourceHtml,
} from "./publishedSources";

export function parseCbaArrears(text: string, now = new Date()) {
  const clean = text.replace(/\s+/g, " ");
  if (!/Commonwealth Bank of Australia/.test(clean))
    throw new Error("Unexpected arrears publisher");
  const periods = [
    ...clean
      .slice(0, 1500)
      .matchAll(
        /For the (?:full|half)[ -]year ended (\d{1,2}) (June|December) (\d{4})/gi,
      ),
  ].map((m) => sourceDate(m[1]!, m[2]!, m[3]!));
  const dates = [...new Set(periods)];
  if (dates.length !== 1)
    throw new Error("Missing or ambiguous CBA reporting period");
  const asOf = dates[0]!;
  requireRecent(asOf, 210, now);
  const matches = [
    ...clean.matchAll(
      /Home loan 90\+ days? arrears (?:were|was) (\d+(?:\.\d+)?)\s*%/gi,
    ),
  ];
  const values = [...new Set(matches.map((m) => m[1]!))];
  if (values.length !== 1 || Number(values[0]) > 20)
    throw new Error("Explicit CBA 90+ day home-loan arrears reading not found");
  return { value: values[0]!, asOf };
}

export async function fetchMortgageArrears(): Promise<MetricOut> {
  const index = await sourceHtml(
    "https://www.commbank.com.au/about-us/investors/results.html",
  );
  const year = new Date().getUTCFullYear();
  // The rolling results page can lag the published annual announcement. Probe
  // the publisher's year-based full-year path too; the PDF must confirm its own
  // date, exact series and freshness before any value is accepted.
  const discovered = [
    ...index.matchAll(/href="([^"?#]+profit-announcement\.pdf)"/gi),
  ].map((m) => new URL(m[1]!, "https://www.commbank.com.au").href);
  const urls = [
    ...new Set([
      `https://www.commbank.com.au/content/dam/commbank-assets/investors/${year}/CBA-${year}-Full-Year-Results-Profit-Announcement.pdf`,
      ...discovered,
    ]),
  ].slice(0, 3);
  const candidates = await Promise.all(
    urls.map(async (url) => {
      try {
        const bytes = await sourceBytes(url, 10_000_000);
        if (bytes.subarray(0, 5).toString() !== "%PDF-")
          throw new Error("Publisher did not return a PDF");
        const pdf = await getDocumentProxy(new Uint8Array(bytes));
        try {
          let text = "";
          // Credit-quality commentary appears near the front, before the long
          // financial statements. Bound CPU/memory as well as download size.
          for (let page = 1; page <= Math.min(pdf.numPages, 45); page++) {
            const content = await (await pdf.getPage(page)).getTextContent();
            text +=
              content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ") + "\n";
          }
          return { ...parseCbaArrears(text), url };
        } finally {
          await pdf.loadingTask.destroy();
        }
      } catch {
        return null;
      }
    }),
  );
  const latest = candidates
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
  if (!latest)
    throw new Error(
      "Current CBA 90+ day home-loan arrears release unavailable",
    );
  return {
    metricKey: "mortgage_arrears",
    label: "CBA Group home-loan arrears",
    value: latest.value,
    unit: "%",
    source: "CBA Group profit announcement",
    sourceUrl: latest.url,
    asOf: latest.asOf,
    groupKey: "PROPERTY",
    displayOrder: 55,
    context:
      "90+ days past due, CBA Group home loans only (including New Zealand retail portfolios). This is a bank portfolio indicator, not an Australian industry arrears rate or the broader non-performing-loans measure.",
  };
}
