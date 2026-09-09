import { createHash } from "node:crypto";
import {
  annualApprovals,
  APPROVAL_FLOW,
  APPROVAL_SOURCE,
  approvalsDataUrl,
  type CityApprovals,
} from "../../shared/cityApprovals";
import { rentPeriod } from "../../shared/cityRents";
import type { verifiedRentReel } from "./verifiedReel";

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
    .map(
      (row) =>
        `${row.city}: ${row.preliminary ? "includes provisional observations; " : ""}${row.revised ? "includes revised observations" : "no revision flag"}`
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
  return {
    stat: {
      label: "Greater Brisbane approvals",
      value: number(a.total),
      line: "Greater Brisbane dwelling approvals over 12 months.",
      subtext: `Year to ${period} · Approved, not completed`,
      source: `ABS Building Approvals · Year to ${period}`,
      facts: [
        { figure: number(a.total), caption: "Greater Brisbane approvals" },
        { figure: number(b.total), caption: "Greater Perth approvals" },
        { figure: "Compare free", caption: "Bio / Markets" },
      ],
    },
    script: [
      { key: "label", text: "Homes approved. But when can anyone move in?" },
      { key: "value", text: `Brisbane recorded ${number(a.total)} dwelling approvals.` },
      { key: "line", text: `That's the year to ${period}, across Greater Brisbane.` },
      { key: "claim", text: "Approvals show permission to build. They aren't finished homes." },
      { key: "facts", text: "Compare Perth on screen. Counts alone don't measure a shortage." },
      { key: "signOff", text: "Check completions and demand too. Compare free through our bio." },
    ],
    publication: { key: "instagram-reel-abs-approvals-brisbane-perth-v1", date: `${a.period}-01` },
    evidenceHash: createHash("sha256").update(JSON.stringify(evidence)).digest("hex"),
    caption: [
      "Approved doesn't mean ready to move in.",
      `Year to ${period}: ${number(a.total)} dwelling units approved in Greater Brisbane; ${number(b.total)} in Greater Perth.`,
      "These are twelve consecutive monthly ABS original counts, all sectors and dwelling types, within Greater Capital City Statistical Areas. They are not seasonally adjusted.",
      "Approvals measure permission to build, not starts or completed homes. These counts do not tell us when homes will be available, whether supply will meet demand, or which city is the better investment.",
      "When comparing markets, check actual completions and demand alongside approvals. Different-sized cities cannot be ranked for shortage using raw approval counts alone.",
      `${flags}. Figures can be revised.`,
      `Source: ${APPROVAL_SOURCE}`,
      `Verified series: ${approvalsDataUrl(asOf)}`,
      "Check the approvals panel: https://thedesk.au/markets/compare/brisbane-vs-perth?utm_source=instagram&utm_medium=reel&utm_campaign=supply_comparison#housing-approvals",
      "Send this to someone comparing Brisbane and Perth's housing supply.",
      "Synthetic male narration: Kokoro / George. #AusProperty #HousingSupply #TheDesk",
    ].join("\n\n"),
  };
}
