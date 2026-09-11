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

/** Stable identities also retain rotation history when a topic's data is withheld. */
export const REEL_PUBLICATION_FAMILIES: Readonly<Record<string, string>> = Object.freeze({
  "instagram-reel-abs-rents-brisbane-perth-v1": "rents",
  "instagram-reel-abs-approvals-brisbane-perth-v1": "supply",
  "instagram-reel-abs-rents-eight-capitals-v1": "rents",
  "instagram-reel-abs-sydney-rent-change-v1": "rents",
  "instagram-reel-abs-sydney-before-buy-v1": "supply",
  "instagram-reel-nhsac-housing-balance-v1": "supply",
  "instagram-reel-rba-new-loan-rates-v1": "borrowing",
  "instagram-reel-abs-interstate-qld-wa-v1": "population",
});

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
    if (entry.candidate) {
      assertProductionCandidate(entry.candidate);
      if (REEL_PUBLICATION_FAMILIES[entry.candidate.publication.key] !== entry.family)
        throw new Error("The Reel publication family is not registered.");
    }
    return entry;
  });
}

export async function getVerifiedReelCandidates(now = new Date()) {
  return (await getVerifiedReelProgramme(now)).flatMap((entry) =>
    entry.candidate ? [{ ...entry.candidate, topic: entry.topic, family: entry.family }] : []
  );
}

/** Evidence adapters own freshness, including each source's release cadence.
 * Prefer the eligible family least recently published (unfeatured first), then
 * newest evidence and registry order. Monthly dates must not crowd out current
 * quarterly stories. This is editorial rotation, not an engagement prediction. */
export function chooseReelCandidate<T extends { publication: { date: string }; family: string }>(
  candidates: T[],
  records: { state: string; publishedAt?: Date | null }[],
  history: { family: string; publishedAt: Date }[] = []
): number {
  const lastByFamily = new Map<string, number>();
  const confirmed = records.flatMap((record, index) =>
    record.state === "published" && record.publishedAt && candidates[index]
      ? [{ family: candidates[index]!.family, publishedAt: record.publishedAt }]
      : []
  );
  for (const item of [...history, ...confirmed]) {
    const time = item.publishedAt.getTime();
    if (Number.isFinite(time))
      lastByFamily.set(item.family, Math.max(lastByFamily.get(item.family) ?? 0, time));
  }
  return (
    candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ index }) => records[index]?.state === "available")
      .sort(
        (a, b) =>
          (lastByFamily.get(a.candidate.family) ?? 0) -
            (lastByFamily.get(b.candidate.family) ?? 0) ||
          b.candidate.publication.date.localeCompare(a.candidate.publication.date) ||
          a.index - b.index
      )[0]?.index ?? -1
  );
}
