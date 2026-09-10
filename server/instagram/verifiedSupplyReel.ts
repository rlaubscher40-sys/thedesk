import { createHash } from "node:crypto";
import { annualApprovals, APPROVAL_FLOW, type CityApprovals } from "../../shared/cityApprovals";
import { rentPeriod } from "../../shared/cityRents";
import type { verifiedRentReel } from "./verifiedReel";
import { buildNarrativeReelCaption, reelReadingCta } from "./reelCaption";
import { approvalStoryboard } from "../video/storyboard";
import { withEvidenceVisual } from "../video/evidenceVisual";

type VerifiedReel = NonNullable<ReturnType<typeof verifiedRentReel>>;

/** Original dwelling-unit counts, never completions or a supply-shortage verdict. */
export function verifiedSupplyReel(data: CityApprovals, now = new Date()): VerifiedReel | null {
  if (!Number.isFinite(now.getTime())) return null;
  const asOf = now.toISOString();
  // The parser checks series identity. Recheck the consumed rows here so a bad
  // cache or a future adapter cannot turn missing/invalid observations into a post.
  const rows = data.observations.filter((row) => ["Brisbane", "Perth"].includes(row.city));
  if (
    rows.some(
      (row) =>
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) ||
        !["", "p", "r"].includes(row.status) ||
        row.dwellings === null ||
        !Number.isSafeInteger(row.dwellings) ||
        row.dwellings < 0
    ) ||
    new Set(rows.map((row) => `${row.city}:${row.period}`)).size !== rows.length
  )
    return null;
  const a = annualApprovals(data, "Brisbane", asOf);
  const b = annualApprovals(data, "Perth", asOf);
  if (
    !a ||
    !b ||
    a.period !== b.period ||
    !Number.isSafeInteger(a.total) ||
    !Number.isSafeInteger(b.total)
  )
    return null;
  const period = rentPeriod(a.period);
  const number = (value: number) => value.toLocaleString("en-AU");
  const flags = [a, b]
    .filter((row) => row.preliminary || row.revised)
    .map(
      (row) =>
        `${row.city}: ${[row.preliminary ? "includes provisional observations" : "", row.revised ? "includes revised observations" : ""].filter(Boolean).join("; ")}`
    )
    .join("; ");
  const evidence = {
    series: APPROVAL_FLOW,
    key: "1.1.9.TOT.TOT.10.3GBRI+5GPER.M",
    unit: "NUM",
    a,
    b,
    rows: rows
      .filter((row) => row.period <= a.period)
      .sort((x, y) => `${x.city}:${x.period}`.localeCompare(`${y.city}:${y.period}`)),
  };
  const storyboard = approvalStoryboard(a.total, b.total, period);
  return withEvidenceVisual(
    {
      stat: {
        storyboard,
        editorialLabel: "Supply and Demand",
        label: "Greater Brisbane approvals",
        value: number(a.total),
        line: "Greater Brisbane dwelling approvals over 12 months.",
        subtext: `Year to ${period} · Approved, not completed`,
        source: `ABS Building Approvals · Year to ${period}`,
        facts: [
          { figure: number(a.total), caption: "Greater Brisbane approvals" },
          { figure: number(b.total), caption: "Greater Perth approvals" },
          reelReadingCta("supplyComparison").fact,
        ],
      },
      script: storyboard.scenes.map(({ key, text }) => ({ key, text })),
      publication: {
        key: "instagram-reel-abs-approvals-brisbane-perth-v1",
        date: `${a.period}-01`,
      },
      evidenceHash: createHash("sha256").update(JSON.stringify(evidence)).digest("hex"),
      caption: buildNarrativeReelCaption({
        paragraphs: [
          "More homes approved. But are we building enough?",
          `Greater Brisbane recorded ${number(a.total)} dwelling approvals in the year to ${period}. Greater Perth recorded ${number(b.total)}.`,
          "Supply only makes sense alongside demand. The question is whether homes being delivered are keeping pace with households needing somewhere to live.",
          "An approval is permission to build. Construction still has to happen before there is a finished home. These figures don't count construction starts or completed homes.",
          "So a bigger approval count doesn't tell us which city has enough housing. These are different-sized cities. We need to compare completions and household demand in the same area and period before drawing that conclusion.",
        ],
        source:
          "Source: ABS Building Approvals. All dwelling types and sectors; original counts, not seasonally adjusted. Figures can be revised.",
        revision: flags ? `${flags}.` : undefined,
        read: "supplyComparison",
      }),
    },
    {
      recipe: "approval-comparison",
      period: `Year to ${period}`,
      rows: [a, b].map((row) => ({ label: `Greater ${row.city}`, value: row.total })),
      readLabel: reelReadingCta("supplyComparison").fact.caption,
    }
  );
}
