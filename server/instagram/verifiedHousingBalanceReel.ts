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
        "Australia built more than a quarter of a million homes. And still fell behind.",
        `From July 2024 to December 2025, around ${number(balance.gross)} homes were completed. After demolitions, the net addition was about ${number(balance.net)}.`,
        `The Housing Council estimates new demand over those same 18 months at ${number(balance.demand)} homes. That leaves an additional gap of roughly ${number(balance.shortfall)}.`,
        `Put simply: about ${balance.netPer100} net new homes for every 100 additional homes needed. New supply did not cover new demand.`,
        "That helps explain why a big construction number can coexist with housing pressure. This measures the gap added during that period, not Australia's total accumulated shortage or the number of homeless households.",
      ],
      source:
        "Based on National Housing Supply and Affordability Council data, State of the Housing System 2026, p. 21. National historical estimates; approximate figures. Demand is modelled from household formation. Report released 30 April 2026.",
      read: "housingBalance",
    }),
  };
}
