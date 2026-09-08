import { createHash } from "node:crypto";
import {
  latestRent,
  rentGap,
  rentPeriod,
  RENT_DATA_URL,
  RENT_SOURCE,
  type CityRents,
} from "../../shared/cityRents";
import type { ReelStat } from "../video/statReel";
import type { ScriptLine } from "../video/narration";
import { propertyComparisonCta } from "./propertyEditorial";

/** One comparable official release, not a daily market-movement claim. */
export function verifiedRentReel(data: CityRents, now = new Date()) {
  const asOf = now.toISOString();
  const a = latestRent(data, "Brisbane"),
    b = latestRent(data, "Perth");
  const gap = rentGap(a, b, asOf);
  if (gap === null || !a || !b || !Number.isFinite(gap) || a.period >= asOf.slice(0, 7))
    return null;
  const period = rentPeriod(a.period);
  const figure = Math.abs(gap).toFixed(1);
  const leading = gap > 0 ? "Brisbane" : "Perth";
  const revision = [a, b]
    .map(
      (row) =>
        `${row.city}: ${row.status === "r" ? "revised" : row.status === "p" ? "provisional" : "no revision flag"}`
    )
    .join("; ");
  const line =
    gap === 0 ? "Annual rent growth is level." : `${leading}'s annual rent growth is higher.`;
  const stat: ReelStat = {
    label: "Brisbane vs Perth rents",
    value: `${figure}pp`,
    line,
    subtext: `Year to ${period} · Growth gap, not rental yield`,
    source: `ABS CPI rents · Year to ${period}`,
    facts: [
      { figure: `${a.annualPercent.toFixed(1)}%`, caption: "Brisbane annual rent growth" },
      { figure: `${b.annualPercent.toFixed(1)}%`, caption: "Perth annual rent growth" },
      { figure: "Compare free", caption: "Bio / Markets" },
    ],
  };
  const script: ScriptLine[] = [
    { key: "label", text: "Brisbane or Perth? Compare rent growth." },
    { key: "value", text: `The gap is ${figure} percentage points.` },
    { key: "line", text: line },
    { key: "claim", text: `Year to ${period}. Rents actually paid, not rental yield.` },
    {
      key: "facts",
      text: `Brisbane, ${a.annualPercent.toFixed(1)} per cent. Perth, ${b.annualPercent.toFixed(1)} per cent.`,
    },
    { key: "signOff", text: "Open the free comparison through our bio. Tap Markets." },
  ];
  const evidence = { series: "ABS:CPI(2.0.0)/3.30014.10.3+5.M/PCT", a, b };
  const hash = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  return {
    stat,
    script,
    // The month is reserved once even if revised: revisions stay in the source
    // read, without quietly republishing the same topic after a restart.
    publication: { key: "instagram-reel-abs-rents-brisbane-perth-v1", date: `${a.period}-01` },
    evidenceHash: hash,
    caption: [
      line,
      `Brisbane ${a.annualPercent.toFixed(1)}% vs Perth ${b.annualPercent.toFixed(1)}%. Year to ${period}.`,
      `Gap: ${figure} percentage points. ABS CPI rents actually paid, original series; capital-city boundaries.`,
      "This measures rent growth, not yield or an overall investment winner. The figures do not establish why rents changed.",
      revision + ". Data can be revised.",
      `Source: ${RENT_SOURCE}`,
      `Verified series: ${RENT_DATA_URL}`,
      propertyComparisonCta("reel"),
      "Synthetic narration: Piper / Cori. #AusProperty #PropertyData #TheDesk",
    ].join("\n\n"),
  };
}
