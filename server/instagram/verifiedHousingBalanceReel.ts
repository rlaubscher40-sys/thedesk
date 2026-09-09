import { createHash } from "node:crypto";
import { matchedHousingBalance, type HousingBalanceSnapshot } from "../../shared/housingBalance";
import { buildNarrativeReelCaption, reelReadingCta } from "./reelCaption";
import { housingBalanceStoryboard } from "../video/housingBalanceStoryboard";
import type { ReelStat } from "../video/statReel";

export function verifiedHousingBalanceReel(data: HousingBalanceSnapshot | null, now = new Date()) {
  const balance = matchedHousingBalance(data);
  if (
    !balance ||
    !data ||
    !Number.isFinite(now.getTime()) ||
    now.toISOString().slice(0, 10) < data.publishedAt ||
    now.toISOString().slice(0, 10) < data.verifiedAt ||
    now.toISOString().slice(0, 10) >= "2027-04-30" ||
    balance.shortfall <= 0
  )
    return null;
  const storyboard = housingBalanceStoryboard(data);
  const number = (n: number) => n.toLocaleString("en-AU");
  const stat: ReelStat = {
    storyboard,
    editorialLabel: "Supply and Demand",
    label: "Australia's new housing gap",
    value: `~${number(balance.shortfall)}`,
    line: "New housing supply fell behind new demand.",
    subtext: `${balance.period} · Estimated additional gap`,
    source: "Based on NHSAC 2026 data · p. 21",
    facts: [
      { figure: number(balance.net), caption: "Net new homes" },
      { figure: number(balance.demand), caption: "Estimated new demand" },
      reelReadingCta("housingBalance").fact,
    ],
  };
  return {
    stat,
    script: storyboard.scenes.map(({ key, text }) => ({ key, text })),
    evidenceHash: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
    publication: { key: "instagram-reel-nhsac-housing-balance-v1", date: balance.end },
    caption: buildNarrativeReelCaption({
      paragraphs: [
        `Australia added about ${number(balance.net)} homes. Yet the housing gap grew.`,
        `From July 2024 to December 2025, net additions after demolitions fell short of an estimated ${number(balance.demand)} extra homes needed. That widened the gap by about ${number(balance.shortfall)} homes.`,
        `Roughly ${balance.netPer100} homes added for every 100 additionally needed. Building more can still leave us falling behind.`,
        "The Council also links high housing and living costs to adult children staying in the parental home longer. That is reported context, not a consequence measured by this gap calculation.",
        "The takeaway: to close a shortage, homes added must outpace extra homes needed. Ask whether we are catching up, not just whether we are building.",
        "These are approximate national estimates for those 18 months, not Australia's total accumulated shortage or a count of homeless households. Demand is modelled from household formation.",
      ],
      source:
        "Source: National Housing Supply and Affordability Council, State of the Housing System 2026, pp. 21 and 44. Released 30 April 2026.",
      read: "housingBalance",
    }),
  };
}
