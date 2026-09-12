import { createHash } from "node:crypto";
import type { RbaHousingRate } from "../../scripts/ingest/lib/rbaHousingRates";
import {
  annualStateDemographics,
  DEMOGRAPHIC_FLOW,
  type StateDemographics,
} from "../../shared/stateDemographics";
import type { ScriptLine } from "../video/narration";
import { withEvidenceVisual } from "../video/evidenceVisual";
import { evidenceOpening } from "../video/reelOpening";
import { buildReelCaption, reelReadingCta } from "./reelCaption";
import {
  LOAN_REPAYMENT_EXAMPLE,
  exampleRepayments,
  loanDollars,
} from "../../shared/loanRepaymentExample";

const hash = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const day = 86_400_000;
const formatPeople = (n: number) => Math.abs(n).toLocaleString("en-AU");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatPeople(n)}`;

/** Monthly comparison of the same new-loan universe, not a cash-rate decision,
 * an advertised offer or a matched-borrower price premium. */
export function verifiedNewLoanRates(rates: RbaHousingRate[], now = new Date()) {
  if (!Number.isFinite(now.getTime()) || rates.length !== 2) return null;
  const a = rates.find((r) => r.seriesId === "FLRHOFTA");
  const b = rates.find((r) => r.seriesId === "FLRHIFTA");
  if (
    !a ||
    !b ||
    a.period.getTime() !== b.period.getTime() ||
    a.publicationDate.getTime() !== b.publicationDate.getTime() ||
    rates.some(
      (r) =>
        !Number.isFinite(r.period.getTime()) ||
        !Number.isFinite(r.publicationDate.getTime()) ||
        !Number.isFinite(r.rate) ||
        r.rate < 0 ||
        r.rate > 30 ||
        now.getTime() < r.period.getTime() ||
        now.getTime() - r.period.getTime() > 95 * day ||
        now.getTime() < r.publicationDate.getTime() ||
        now.getTime() - r.publicationDate.getTime() > 62 * day ||
        r.publicationDate < r.period
    )
  )
    return null;
  const period = a.period.toISOString().slice(0, 7);
  if (period >= now.toISOString().slice(0, 7)) return null;
  const label = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(a.period);
  const textRate = (n: number) => `${n.toFixed(1)} percent`;
  const opening = evidenceOpening("new-loan-rates", [
    { label: "Owner-occupiers", value: a.rate },
    { label: "Investors", value: b.rate },
  ]);
  const script: ScriptLine[] = [
    { key: "label", text: opening.voice },
    { key: "value", text: `Owner occupiers, ${textRate(a.rate)}. Investors, ${textRate(b.rate)}.` },
    { key: "line", text: "New-loan averages, not personal offers." },
    {
      key: "claim",
      text: "Example: five hundred thousand at six percent. Thirty years, about three thousand monthly.",
    },
    { key: "facts", text: "Twenty-five years: higher repayments, less total interest." },
    { key: "signOff", text: "Compare the amount, term and fees. Details in our bio." },
  ];
  const source = `RBA / APRA · F6 new loans · ${label}`;
  return withEvidenceVisual(
    {
      stat: {
        label: "New home-loan rates",
        value: `${a.rate.toFixed(1)}%`,
        line: "What borrowers paid on average.",
        subtext: `${label} · New loans funded · Australia`,
        source,
        facts: [
          { figure: `${a.rate.toFixed(1)}%`, caption: "Owner-occupier new loans" },
          { figure: `${b.rate.toFixed(1)}%`, caption: "Investor new loans" },
          reelReadingCta("newLoanRates").fact,
        ],
      },
      script,
      evidenceHash: hash({ table: "RBA:F6", rates: [a, b], example: LOAN_REPAYMENT_EXAMPLE }),
      publication: { key: "instagram-reel-rba-new-loan-rates-v1", date: `${period}-01` },
      caption: buildReelCaption({
        hook: opening.voice,
        finding: `${label}: new owner-occupier loans averaged ${a.rate.toFixed(1)}% a year; investor loans ${b.rate.toFixed(1)}%. Australia, all institutions.`,
        meaning:
          "These averages cover loans funded during the month, including fixed and variable rates. Different borrower and loan mixes mean the gap is not a like-for-like price premium or a rate everyone can get.",
        method: `Source: RBA / APRA F6, FLRHOFTA and FLRHIFTA. Illustration: $500,000 at an unchanged 6% a year, monthly principal and interest, no fees or extra payments. ${exampleRepayments()
          .map((r) => `${r.years} years: ${loanDollars(r.monthly)}/month`)
          .join(
            "; "
          )}. The Desk calculation, rounded dollars; not an offer or forecast. Method and context: ASIC Moneysmart mortgage calculator and loan guide.`,
        revisions:
          "Original monthly series. RBA tables can be revised. Figures are not the cash rate.",
        action:
          "Read the comparison rate and fees alongside repayments, loan amount and term. Save this for your next loan comparison.",
        read: "newLoanRates",
      }),
    },
    {
      recipe: "new-loan-rates",
      repaymentExample: LOAN_REPAYMENT_EXAMPLE,
      period: label,
      rows: [
        { label: "Owner-occupiers", value: a.rate },
        { label: "Investors", value: b.rate },
      ],
      readLabel: reelReadingCta("newLoanRates").fact.caption,
    }
  );
}

/** Annual net internal migration for the two states in the existing public
 * comparison. Never relabel it as city growth, arrivals, or homes required. */
export function verifiedInterstateMigration(data: StateDemographics, now = new Date()) {
  // The programme captures its clock before awaiting source reads. Allow the
  // bounded retrieval to finish within that minute, not a future observation.
  const retrieved = Date.parse(data.retrievedAt ?? "");
  if (
    !Number.isFinite(now.getTime()) ||
    data.status !== "available" ||
    !Number.isFinite(retrieved) ||
    retrieved > now.getTime() + 60_000 ||
    now.getTime() - retrieved > 2 * day
  )
    return null;
  const states = ["Queensland", "Western Australia"];
  const rows = data.observations.filter((r) => states.includes(r.state));
  if (
    rows.some(
      (r) =>
        !["", "p", "r"].includes(r.status) ||
        r.people === null ||
        !Number.isSafeInteger(r.people) ||
        (r.measure === "population" && r.people <= 0)
    ) ||
    new Set(rows.map((r) => `${r.state}:${r.measure}:${r.period}`)).size !== rows.length
  )
    return null;
  const [a, b] = states.map((s) =>
    annualStateDemographics(data, s, now.toISOString().slice(0, 10))
  );
  if (!a || !b || a.period !== b.period) return null;
  const [year, q] = a.period.split("-Q");
  const month = ["March", "June", "September", "December"][Number(q) - 1]!;
  const period = `Year to ${month} ${year}`;
  const opening = evidenceOpening("interstate-migration", [
    { label: "Queensland", value: a.netInternalMigration },
    { label: "Western Australia", value: b.netInternalMigration },
  ]);
  const net = (n: number) =>
    n > 0
      ? `a net gain of ${formatPeople(n)}`
      : n < 0
        ? `a net loss of ${formatPeople(n)}`
        : "no net change";
  const script: ScriptLine[] = [
    { key: "label", text: opening.voice },
    {
      key: "value",
      text: `Queensland, ${net(a.netInternalMigration)}. Western Australia, ${net(b.netInternalMigration)}.`,
    },
    {
      key: "line",
      text: "Net means arrivals minus departures.",
    },
    { key: "claim", text: "Moving between states shifts where people need homes." },
    { key: "facts", text: "State totals cannot show a suburb's housing shortage." },
    {
      key: "signOff",
      text: "Check local population and completed homes together.",
    },
  ];
  const revision = [a, b].some((r) => r.preliminary)
    ? "Includes preliminary observations."
    : "No preliminary flag.";
  return withEvidenceVisual(
    {
      stat: {
        label: "Interstate migration",
        value: signed(a.netInternalMigration),
        line: "People moving between states.",
        subtext: `${period} · State totals, not cities`,
        source: `ABS population components · ${period}`,
        facts: [
          { figure: signed(a.netInternalMigration), caption: "Queensland net interstate" },
          { figure: signed(b.netInternalMigration), caption: "Western Australia net interstate" },
          reelReadingCta("interstateMigration").fact,
        ],
      },
      script,
      evidenceHash: hash({
        series: DEMOGRAPHIC_FLOW,
        rows: [...rows].sort((a, b) =>
          `${a.state}:${a.measure}:${a.period}`.localeCompare(`${b.state}:${b.measure}:${b.period}`)
        ),
      }),
      publication: {
        key: "instagram-reel-abs-interstate-qld-wa-v1",
        date: `${year}-${String(Number(q) * 3).padStart(2, "0")}-01`,
      },
      caption: buildReelCaption({
        hook: opening.voice,
        finding: `${period}: Queensland recorded ${net(a.netInternalMigration)} people through interstate migration; Western Australia ${net(b.netInternalMigration)}.`,
        meaning:
          "Net means interstate arrivals minus departures. These are state totals, not Brisbane or Perth figures. They exclude overseas migration and natural increase, so they do not measure total population growth or extra homes needed.",
        method:
          "Source: ABS National, state and territory population, ERP_COMP_Q net internal migration. Sum of four consecutive quarterly observations.",
        revisions: `${revision} ${[a, b].some((r) => r.revised) ? "Includes revised observations." : "No revision flag."} Estimates can be revised.`,
        action:
          "For a local housing decision, compare local household growth, vacancies and completed homes. Migration alone is not a price forecast.",
        read: "interstateMigration",
      }),
    },
    {
      recipe: "interstate-migration",
      period,
      rows: [
        { label: "Queensland", value: a.netInternalMigration },
        { label: "Western Australia", value: b.netInternalMigration },
      ],
      readLabel: reelReadingCta("interstateMigration").fact.caption,
    }
  );
}
