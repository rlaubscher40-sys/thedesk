import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { fetchAllAbs, parseAbsRelease } from "./abs";
const now = new Date("2026-09-17T08:00:00Z");
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/abs-macro/${name}.html`, import.meta.url), "utf8");
const cases = [
  ["cpi_trimmed", "cpi", "3.6", "2026-07"],
  ["unemployment", "labour", "4.5", "2026-07"],
  ["wage_growth", "wage", "3.2", "2026-06"],
  ["building_approvals", "approvals", "17,687", "2026-07"],
  ["net_migration", "population", "292,137", "2026-03"],
];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it.each(cases)(
  "reads the reviewed official %s table's exact measure and period",
  (key, file, value, period) => {
    const result = parseAbsRelease(key!, fixture(file!), now)!;
    expect(result.value).toBe(value);
    expect(result.asOf.toISOString().slice(0, 7)).toBe(period);
    const source = new URL(result.sourceUrl);
    expect(source.origin).toBe("https://www.abs.gov.au");
    expect(source.pathname).toMatch(/^\/statistics\/.+\/latest-release$/);
  }
);
it("selects annual wages, not the adjacent quarterly figure or page prose", () => {
  const html = fixture("wage");
  const result = parseAbsRelease(
    "wage_growth",
    html + "<p>Wage price index rose 0.8%. Annual growth 99%.</p>",
    now
  )!;
  expect(result.value).toBe("3.2");
  expect(result.context).toContain("annual change");
  expect(result.context).toContain("seasonally adjusted");
});
it("preserves NOM's exact annual persons rather than rounded prose or quarterly flows", () => {
  const result = parseAbsRelease(
    "net_migration",
    fixture("population") + "<p>Annual net overseas migration was 292,100. Quarterly: 101,005.</p>",
    now
  )!;
  expect(result.value).toBe("292,137");
  expect(result.context).toContain("year ending reference quarter");
});
it.each([
  [
    "wrong adjustment",
    (s: string) => s.replace("Key statistics - Seasonally adjusted", "Key statistics - Trend"),
  ],
  [
    "wrong geography/title",
    (s: string) => s.replace("Labour Force, Australia", "Labour Force, New South Wales"),
  ],
  ["unmatched current period", (s: string) => s.replaceAll("Jul-26", "May-26")],
  ["duplicate period column", (s: string) => s.replaceAll("Jun-26", "Jul-26")],
  ["suppressed current value", (s: string) => s.replaceAll("4.5%", "np")],
  ["unexpected unit", (s: string) => s.replaceAll("4.5%", "4.5 pts")],
  [
    "missing reference field",
    (s: string) => s.replaceAll("field--name-field-abs-reference-period", "unrelated"),
  ],
  ["future reference month", (s: string) => s.replaceAll("July 2026", "July 2027")],
])("withholds %s without falling back to earlier/prose values", (_reason, mutate) => {
  expect(
    parseAbsRelease(
      "unemployment",
      mutate(fixture("labour")) + "<p>Unemployment rate 4.5%</p>",
      now
    )
  ).toBeNull();
});
it("rejects duplicate current rows, duplicate tables, merged cells and malformed rows", () => {
  const html = fixture("wage");
  expect(parseAbsRelease("wage_growth", html.replaceAll("Mar-26", "Jun-26"), now)).toBeNull();
  const table = html.slice(html.indexOf("<table"));
  expect(parseAbsRelease("wage_growth", html + table, now)).toBeNull();
  expect(parseAbsRelease("wage_growth", html.replace("<td", '<td colspan="2"'), now)).toBeNull();
  expect(
    parseAbsRelease("wage_growth", html.replace("</tbody>", "<tr></tr></tbody>"), now)
  ).toBeNull();
});
it("supports reordered columns through their measure labels", () => {
  const html = fixture("wage")
    .replace("Quarterly (%)", "PLACEHOLDER")
    .replace("Annual (%)", "Quarterly (%)")
    .replace("PLACEHOLDER", "Annual (%)")
    .replaceAll(">0.8<", ">SWAP<")
    .replaceAll(">3.2<", ">0.8<")
    .replaceAll(">SWAP<", ">3.2<");
  expect(parseAbsRelease("wage_growth", html, now)?.value).toBe("3.2");
});
it("fails closed on unfamiliar quarter/date and count formats", () => {
  expect(
    parseAbsRelease("wage_growth", fixture("wage").replaceAll("June 2026", "July 2026"), now)
  ).toBeNull();
  expect(
    parseAbsRelease("building_approvals", fixture("approvals").replaceAll("17,687", "17,68"), now)
  ).toBeNull();
  expect(
    parseAbsRelease(
      "building_approvals",
      fixture("approvals").replaceAll("17,687", "17.687 thousand"),
      now
    )
  ).toBeNull();
  expect(
    parseAbsRelease("building_approvals", fixture("approvals"), new Date("invalid"))
  ).toBeNull();
});
it("accepts signed annual growth, preserving a contraction", () => {
  expect(
    parseAbsRelease("wage_growth", fixture("wage").replaceAll(">3.2<", ">-0.2<"), now)?.value
  ).toBe("-0.2");
});
it("reports failed contracts per source while retaining independently verified metrics", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const fetch = vi.fn(async (url: string) => {
    const file = url.includes("consumer-price")
      ? "cpi"
      : url.includes("labour-force")
        ? "labour"
        : url.includes("wage-price")
          ? "wage"
          : url.includes("building-approvals")
            ? "approvals"
            : "population";
    return new Response(file === "wage" ? "<h1>Service unavailable</h1>" : fixture(file));
  });
  vi.stubGlobal("fetch", fetch);
  const failed = vi.fn();
  const results = await fetchAllAbs(failed);
  expect(results.filter(Boolean)).toHaveLength(4);
  expect(failed).toHaveBeenCalledWith(
    "wage_growth",
    expect.stringContaining("could not be verified")
  );
  expect(fetch).toHaveBeenCalledTimes(5);
});
