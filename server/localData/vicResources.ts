export const VIC_CATALOGUE = "https://discover.data.vic.gov.au/api/3/action/package_show?id=rental-report-quarterly-quarterly-median-rents-by-lga";
const quarters: Record<string, string> = { march: "03-31", june: "06-30", september: "09-30", december: "12-31" };

/** Exact public publisher URL, not a user-controlled fetch target. */
export function vicResource(url: string, now = new Date()) {
  const match = /^https:\/\/www\.dffh\.vic\.gov\.au\/quarterly-median-rents?-local-government-area-(march|june|september|december)-quarter-(20\d{2})(?:-excel)?$/.exec(url);
  if (!match) throw new Error("Use the official DFFH quarterly LGA workbook link");
  const period = `${match[2]}-${quarters[match[1]!]}`;
  if (period >= now.toISOString().slice(0, 10)) throw new Error("The workbook quarter must be complete");
  return { url, period };
}

export function selectVicResource(body: string, now = new Date()) {
  const json = JSON.parse(body);
  const dataset = json.result;
  if (json.success !== true || dataset?.name !== "rental-report-quarterly-quarterly-median-rents-by-lga" ||
      !["cc-by", "cc-by-4.0"].includes(dataset.license_id) || !Array.isArray(dataset.resources))
    throw new Error("Victorian catalogue identity or licence needs review");
  const candidates = dataset.resources.flatMap((resource: {url?: unknown; format?: unknown}) => {
    if (resource.format !== "XLSX" || typeof resource.url !== "string") return [];
    try { return [vicResource(resource.url, now)]; } catch { return []; }
  }).sort((a: {period: string}, b: {period: string}) => b.period.localeCompare(a.period));
  const latest = candidates[0] as {url: string; period: string} | undefined;
  if (!latest) throw new Error("No completed Victorian LGA workbook listed");
  if (new Set(candidates.filter((r: {period: string}) => r.period === latest.period).map((r: {url: string}) => r.url)).size !== 1)
    throw new Error("Ambiguous Victorian release links");
  return latest;
}
