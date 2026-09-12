import { createHash } from "node:crypto";
import { latestRent, rentGap, rentPeriod, type CityRents } from "../../shared/cityRents";
import type { ReelStat } from "../video/statReel";
import type { ScriptLine } from "../video/narration";
import { buildReelCaption, reelReadingCta } from "./reelCaption";
import { withEvidenceVisual } from "../video/evidenceVisual";
import { evidenceOpening } from "../video/reelOpening";

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
      reelReadingCta("rentComparison").fact,
    ],
  };
  // The measured utterances introduce each observed rate before revealing the
  // gap. Directional copy also handles zero, tied and falling observations.
  const meaning =
    gap === 0
      ? "Neither city's annual rate was higher."
      : `${leading}'s annual rate was ${figure} percentage points higher.`;
  const rate = (n: number) => `${n < 0 ? "minus " : ""}${Math.abs(n).toFixed(1)} percent`;
  const opening = evidenceOpening(
    "rent-comparison",
    [a, b].map((row) => ({ label: row.city, value: row.annualPercent }))
  );
  const script: ScriptLine[] = [
    { key: "label", text: opening.voice },
    { key: "value", text: `Brisbane, ${rate(a.annualPercent)}. Perth, ${rate(b.annualPercent)}.` },
    { key: "line", text: meaning },
    { key: "claim", text: "That is the change. Not which city costs more to rent." },
    {
      key: "facts",
      text: "Your return also depends on purchase price and ownership costs.",
    },
    {
      key: "signOff",
      text: "Rent growth is not yield. Full comparison in our bio.",
    },
  ];
  const evidence = { series: "ABS:CPI(2.0.0)/3.30014.10.3+5.M/PCT", a, b };
  const hash = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  return withEvidenceVisual(
    {
      stat,
      script,
      // The month is reserved once even if revised: revisions stay in the source
      // read, without quietly republishing the same topic after a restart.
      publication: { key: "instagram-reel-abs-rents-brisbane-perth-v1", date: `${a.period}-01` },
      evidenceHash: hash,
      caption: buildReelCaption({
        hook: opening.voice,
        finding: `Brisbane ${a.annualPercent.toFixed(1)}% vs Perth ${b.annualPercent.toFixed(1)}%. Year to ${period}. Gap: ${figure} percentage points.`,
        meaning: `${line} These percentages track rents actually paid. They do not tell you which city has higher weekly rents, or which property offers the better return. Purchase price and ownership costs matter too.`,
        method:
          "Source: ABS CPI rents actually paid, original capital-city series. Illustrative photography credited on screen.",
        revisions: revision + ". Data can be revised.",
        action:
          "Use growth to understand the change. Check rent levels, purchase prices and costs to compare returns.",
        read: "rentComparison",
      }),
    },
    {
      recipe: "rent-comparison",
      period: `Year to ${period}`,
      rows: [a, b].map((row) => ({ label: row.city, value: row.annualPercent })),
      readLabel: reelReadingCta("rentComparison").fact.caption,
    }
  );
}
