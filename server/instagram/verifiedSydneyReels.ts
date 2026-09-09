import { createHash } from "node:crypto";
import { rentPeriod, type CityRents } from "../../shared/cityRents";
import { annualApprovals, APPROVAL_FLOW, type CityApprovals } from "../../shared/cityApprovals";
import type { verifiedRentReel } from "./verifiedReel";
import { buildReelCaption, reelReadingCta } from "./reelCaption";
type VerifiedReel = NonNullable<ReturnType<typeof verifiedRentReel>>;
const monthIndex = (period: string) => Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7));
const validPeriod = (period: string, now: Date) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && period < now.toISOString().slice(0, 7);
function fresh(data: { status: string; retrievedAt: string | null }, now: Date) {
  const fetched = Date.parse(data.retrievedAt ?? "");
  return (
    Number.isFinite(now.getTime()) &&
    data.status === "available" &&
    Number.isFinite(fetched) &&
    fetched <= now.getTime() + 60_000 &&
    now.getTime() - fetched <= 86_400_000
  );
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Compare two consecutive annual rates, NEVER call their difference monthly rent inflation. */
export function verifiedSydneyRentChange(data: CityRents, now = new Date()): VerifiedReel | null {
  if (!fresh(data, now)) return null;
  const rows = data.observations
    .filter((row) => row.city === "Sydney")
    .sort((a, b) => b.period.localeCompare(a.period));
  if (
    rows.length !== 2 ||
    rows.some(
      (row) =>
        !validPeriod(row.period, now) ||
        !["", "p", "r"].includes(row.status) ||
        !Number.isFinite(row.annualPercent) ||
        row.annualPercent < -100 ||
        Math.abs(row.annualPercent * 10 - Math.round(row.annualPercent * 10)) > 1e-8
    )
  )
    return null;
  const [current, previous] = rows as [(typeof rows)[number], (typeof rows)[number]];
  if (
    monthIndex(current.period) - monthIndex(previous.period) !== 1 ||
    monthIndex(now.toISOString()) - monthIndex(current.period) > 3
  )
    return null;
  const delta = Math.round((current.annualPercent - previous.annualPercent) * 10) / 10;
  // No change is not a new What Changed story.
  if (delta === 0) return null;
  const signed = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp`;
  const period = rentPeriod(current.period),
    prior = rentPeriod(previous.period);
  const rates = `${previous.annualPercent.toFixed(1)}% to ${current.annualPercent.toFixed(1)}%`;
  const meaning =
    current.annualPercent > 0
      ? "Rents paid were still higher than a year earlier."
      : current.annualPercent < 0
        ? "Rents paid were lower than a year earlier."
        : "Rents paid were unchanged from a year earlier.";
  return {
    stat: {
      editorialLabel: "What Changed",
      label: "Sydney annual rent-change rate",
      value: signed,
      line: `Annual rate ${delta > 0 ? "increased" : "decreased"} between releases.`,
      subtext: `${prior} to ${period} · Not monthly rent change`,
      source: `ABS CPI rents · ${prior} and ${period}`,
      facts: [
        { figure: rates, caption: "Annual change · previous to latest" },
        { figure: "Check the period", caption: "Not asking rents or rental yield" },
        reelReadingCta("sydneyRent").fact,
      ],
    },
    script: [
      { key: "label", text: "Sydney rents: what actually changed?" },
      {
        key: "value",
        text: `The annual rate moved ${Math.abs(delta).toFixed(1)} percentage points ${delta > 0 ? "higher" : "lower"}.`,
      },
      {
        key: "line",
        text: `From ${previous.annualPercent.toFixed(1)} to ${current.annualPercent.toFixed(1)} percent. Year to ${period}.`,
      },
      { key: "claim", text: meaning },
      { key: "facts", text: "Two annual rates don't tell us this month's rent change." },
      { key: "signOff", text: reelReadingCta("sydneyRent").voice },
    ],
    publication: { key: "instagram-reel-abs-sydney-rent-change-v1", date: `${current.period}-01` },
    evidenceHash: hash({ series: "ABS:CPI(2.0.0)/3.30014.10.1.M/PCT", rows }),
    caption: buildReelCaption({
      hook: "Sydney rents: what actually changed?",
      finding: `Annual rent change: ${previous.annualPercent.toFixed(1)}% in the year to ${prior}; ${current.annualPercent.toFixed(1)}% in the year to ${period}. Difference: ${signed}. ${meaning}`,
      meaning:
        "This compares two annual rates, not the percentage change in rents during the latest month. Different year-earlier bases can affect annual rates. Not asking rents, dollar levels, yields or all of NSW.",
      method: "Source: ABS CPI rents actually paid, Sydney capital-city original series.",
      revisions: `${rows.map((r) => `${r.period}: ${r.status === "p" ? "provisional" : r.status === "r" ? "revised" : "no revision flag"}`).join("; ")}. Data can be revised.`,
      action:
        delta < 0 && current.annualPercent > 0
          ? "Send this to someone who reads slower rent growth as falling rents."
          : "Send this to someone comparing rent headlines: the period and definition matter.",
      read: "sydneyRent",
    }),
  };
}

/** A buyer's evidence checklist anchored to twelve observed Sydney approval counts. */
export function verifiedSydneyBeforeBuy(
  data: CityApprovals,
  now = new Date()
): VerifiedReel | null {
  if (!fresh(data, now)) return null;
  const rows = data.observations
    .filter((row) => row.city === "Sydney")
    .sort((a, b) => b.period.localeCompare(a.period));
  if (
    rows.some(
      (row) =>
        !validPeriod(row.period, now) ||
        !["", "p", "r"].includes(row.status) ||
        row.dwellings === null ||
        !Number.isSafeInteger(row.dwellings) ||
        row.dwellings < 0
    ) ||
    new Set(rows.map((row) => row.period)).size !== rows.length
  )
    return null;
  const annual = annualApprovals(data, "Sydney", now.toISOString());
  if (!annual || !Number.isSafeInteger(annual.total)) return null;
  const count = annual.total.toLocaleString("en-AU"),
    period = rentPeriod(annual.period);
  return {
    stat: {
      editorialLabel: "Before You Buy",
      label: "Greater Sydney dwelling approvals",
      value: count,
      line: "Approved over twelve months. Not completed homes.",
      subtext: `Year to ${period} · Original counts`,
      source: `ABS Building Approvals · Year to ${period}`,
      facts: [
        { figure: "1 · Stage", caption: "Permission, construction or completion?" },
        { figure: "2 · Place", caption: "Greater Sydney is not your suburb" },
        { figure: "3 · Timing", caption: "When might homes become available?" },
      ],
    },
    script: [
      { key: "label", text: "Buying in Sydney? Check what the supply number counts." },
      { key: "value", text: `Greater Sydney recorded ${count} dwelling approvals.` },
      { key: "line", text: `That's twelve months to ${period}. Not completed homes.` },
      { key: "claim", text: "Before using it, check the building stage and the local area." },
      { key: "facts", text: "A city total can't tell you when homes near you will be ready." },
      { key: "signOff", text: reelReadingCta("sydneySupply").voice },
    ],
    publication: { key: "instagram-reel-abs-sydney-before-buy-v1", date: `${annual.period}-01` },
    evidenceHash: hash({
      series: APPROVAL_FLOW,
      key: "1.1.9.TOT.TOT.10.1GSYD.M/NUM",
      rows: rows.slice(0, 12),
    }),
    caption: buildReelCaption({
      hook: "Buying in Sydney? Three checks before using a supply headline.",
      finding: `${count} dwelling units approved across Greater Sydney in the year to ${period}.`,
      meaning:
        "1. Stage: permission, not a start or a completion.\n2. Place: Greater Sydney, not your suburb or all NSW.\n3. Timing: check construction and completions before assuming homes are available. Counts alone don't establish shortage, future prices or investment quality.",
      method:
        "Source: ABS Building Approvals; twelve monthly original counts, all sectors and dwelling types. Not seasonally or population-adjusted.",
      revisions: `${annual.preliminary ? "Includes provisional observations. " : ""}${annual.revised ? "Includes revised observations. " : ""}Data can be revised.`,
      action: "Save the stage, place and timing checklist for your next property comparison.",
      read: "sydneySupply",
    }),
  };
}
