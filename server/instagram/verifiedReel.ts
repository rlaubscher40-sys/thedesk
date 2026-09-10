import { createHash } from "node:crypto";
import { latestRent, rentGap, rentPeriod, type CityRents } from "../../shared/cityRents";
import type { ReelStat } from "../video/statReel";
import type { ScriptLine } from "../video/narration";
import { buildReelCaption, reelReadingCta } from "./reelCaption";
import { withEvidenceVisual } from "../video/evidenceVisual";

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
  // Interpret the measure, not its cause. The screen carries the individual
  // rates; the voice explains the comparison and the missing decision inputs.
  const meaning =
    gap === 0
      ? "Neither city's rent index changed faster over the year."
      : a.annualPercent >= 0 && b.annualPercent >= 0
        ? `${leading}'s rent index rose faster. That's rents actually paid.`
        : "This compares changes in rents actually paid, including falls.";
  const script: ScriptLine[] = [
    { key: "label", text: "Brisbane or Perth: where did rents change faster?" },
    { key: "value", text: `The rent growth gap: ${figure} percentage points.` },
    { key: "line", text: meaning },
    {
      key: "claim",
      text: `Year to ${period}. That's the pace of change, not how expensive rents are.`,
    },
    { key: "facts", text: "A buyer still needs purchase prices and costs to compare returns." },
    { key: "signOff", text: reelReadingCta("rentComparison").voice },
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
        hook: "Brisbane or Perth: where did rents change faster?",
        finding: `Brisbane ${a.annualPercent.toFixed(1)}% vs Perth ${b.annualPercent.toFixed(1)}%. Year to ${period}. Gap: ${figure} percentage points.`,
        meaning: `${line} This is the pace of change, not dollar rents, rental yield or a better-investment verdict. It does not explain why rents changed.`,
        method: "Source: ABS CPI rents actually paid, original capital-city series.",
        revisions: revision + ". Data can be revised.",
        action: "Save this comparison. Check purchase prices and costs before comparing returns.",
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
