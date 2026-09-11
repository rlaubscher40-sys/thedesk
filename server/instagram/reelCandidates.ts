import { getStateDemographics } from "../markets/absDemographics";
import { getReelLendingRates } from "../markets/reelLendingRates";
import { verifiedInterstateMigration, verifiedNewLoanRates } from "./verifiedContextReels";
import { getHousingBalanceSnapshot } from "../markets/housingBalance";
import { verifiedHousingBalanceReel } from "./verifiedHousingBalanceReel";
import { getCityRents } from "../markets/absRents";
import { getCityApprovals } from "../markets/absApprovals";
import { verifiedRentReel } from "./verifiedReel";
import { verifiedSupplyReel } from "./verifiedSupplyReel";
import { verifiedCapitalRentReel } from "./verifiedCapitalRentReel";
import { verifiedSydneyBeforeBuy, verifiedSydneyRentChange } from "./verifiedSydneyReels";
import { assertProductionCandidate } from "../video/reelProduction";

/** Shared editorial registry: scheduled publishing and the admin read use the same recipes. */
export async function getVerifiedReelProgramme(now = new Date()) {
  const [rents, approvals, housingBalance, demographics, lending] = await Promise.all([
    getCityRents(),
    getCityApprovals(),
    getHousingBalanceSnapshot(),
    getStateDemographics(),
    getReelLendingRates(),
  ]);
  return [
    {
      topic: "Market vs Market · rents",
      family: "rents",
      candidate: verifiedRentReel(rents, now),
      requirement: "Matching current Brisbane and Perth annual rent rates.",
    },
    {
      topic: "Market vs Market · supply",
      family: "supply",
      candidate: verifiedSupplyReel(approvals, now),
      requirement: "Twelve consecutive approval counts for both cities, with matching end months.",
    },
    {
      topic: "Across the capitals",
      family: "rents",
      candidate: verifiedCapitalRentReel(rents, now),
      requirement: "Eight valid capital-city rates for the same current month.",
    },
    {
      topic: "What Changed · Sydney rents",
      family: "rents",
      candidate: verifiedSydneyRentChange(rents, now),
      requirement:
        "Two consecutive Sydney annual rates and a non-zero change; current retrieved evidence.",
    },
    {
      topic: "Before You Buy · Sydney supply",
      family: "supply",
      candidate: verifiedSydneyBeforeBuy(approvals, now),
      requirement: "Twelve consecutive valid Greater Sydney approvals; current retrieved evidence.",
    },
    {
      topic: "Australia · housing supply and demand",
      family: "supply",
      candidate: verifiedHousingBalanceReel(housingBalance, now),
      requirement:
        "Reviewed national net supply and estimated new demand for the same historical period, from the current report vintage.",
    },
    {
      topic: "Borrowing costs · new home loans",
      family: "borrowing",
      candidate: verifiedNewLoanRates(lending, now),
      requirement:
        "Matching current RBA F6 owner-occupier and investor new-loan rates; one episode per observation month.",
    },
    {
      topic: "Population movement · Queensland and WA",
      family: "population",
      candidate: verifiedInterstateMigration(demographics, now),
      requirement:
        "Four consecutive net interstate quarters for both states, same current reference quarter and recent verified retrieval.",
    },
  ].map((entry) => {
    if (entry.candidate) assertProductionCandidate(entry.candidate);
    return entry;
  });
}

export async function getVerifiedReelCandidates(now = new Date()) {
  return (await getVerifiedReelProgramme(now)).flatMap((entry) =>
    entry.candidate ? [{ ...entry.candidate, topic: entry.topic, family: entry.family }] : []
  );
}

/** Newest evidence first; for matching months prefer a different evidence family
 * from the most recently confirmed topic. Stable registry order breaks ties.
 * This is an editorial rule, not an engagement prediction. */
export function chooseReelCandidate<T extends { publication: { date: string }; family: string }>(
  candidates: T[],
  records: { state: string; publishedAt?: Date | null }[]
): number {
  const last = records
    .map((record, index) => ({ record, index }))
    .filter(
      ({ record }) =>
        record.state === "published" &&
        record.publishedAt &&
        Number.isFinite(record.publishedAt.getTime())
    )
    .sort((a, b) => b.record.publishedAt!.getTime() - a.record.publishedAt!.getTime())[0];
  return (
    candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ index }) => records[index]?.state === "available")
      .sort(
        (a, b) =>
          b.candidate.publication.date.localeCompare(a.candidate.publication.date) ||
          (last
            ? Number(a.candidate.family === candidates[last.index]?.family) -
              Number(b.candidate.family === candidates[last.index]?.family)
            : 0) ||
          a.index - b.index
      )[0]?.index ?? -1
  );
}
