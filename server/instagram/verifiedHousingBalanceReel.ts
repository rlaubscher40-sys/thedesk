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
        `Australia built around ${number(balance.gross)} homes. So why did the housing gap grow?`,
        "Someone moves out of their parents' home. The same people now form two households, needing two homes. Housing need can grow even when the number of people stays the same.",
        `From July 2024 to December 2025, demolitions reduced that to about ${number(balance.net)} net new homes. Meanwhile, households needed an estimated ${number(balance.demand)} extra homes.`,
        `The difference: roughly ${number(balance.shortfall)} homes. About ${balance.netPer100} added for every 100 additionally needed.`,
        "Thousands of homes built, yet we still fell further behind. Next time you see a housing headline, compare homes actually added with extra homes needed, in the same place over the same period.",
        "This is the additional gap over those 18 months, not Australia's total accumulated shortage or a count of homeless households.",
      ],
      source:
        "Based on National Housing Supply and Affordability Council data, State of the Housing System 2026, p. 21. National historical estimates; approximate figures. Demand is modelled from household formation. Report released 30 April 2026.",
      read: "housingBalance",
    }),
  };
}
