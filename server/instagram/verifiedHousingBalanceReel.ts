import { createHash } from "node:crypto";
import { matchedHousingBalance, type HousingBalanceSnapshot } from "../../shared/housingBalance";
import { buildNarrativeReelCaption, reelReadingCta } from "./reelCaption";
import { HOUSING_DEPOSIT } from "../../shared/housingAffordability";
import {
  housingBalanceStoryboard,
  type HousingBalanceStoryboard,
} from "../video/housingBalanceStoryboard";
import type { ReelStat } from "../video/statReel";

export function verifiedHousingBalanceReel(
  data: HousingBalanceSnapshot | null,
  now = new Date(),
  opening: HousingBalanceStoryboard["opening"] = "question"
) {
  const balance = matchedHousingBalance(data);
  if (
    !balance ||
    !data ||
    !Number.isFinite(now.getTime()) ||
    now.toISOString().slice(0, 10) < data.publishedAt ||
    now.toISOString().slice(0, 10) < data.verifiedAt ||
    now.toISOString().slice(0, 10) < HOUSING_DEPOSIT.verifiedAt ||
    now.toISOString().slice(0, 10) >= "2027-04-30" ||
    balance.shortfall <= 0
  )
    return null;
  const storyboard = housingBalanceStoryboard(data, opening);
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
    evidenceHash: createHash("sha256")
      .update(JSON.stringify({ housing: data, deposit: HOUSING_DEPOSIT }))
      .digest("hex"),
    publication: { key: "instagram-reel-nhsac-housing-balance-v1", date: balance.end },
    caption: buildNarrativeReelCaption({
      paragraphs: [
        storyboard.scenes[0]!.text,
        `July 2024 to December 2025: about ${number(balance.net)} net new homes, against ${number(balance.demand)} extra homes needed. An additional gap of about ${number(balance.shortfall)}.`,
        "Competition for scarce housing puts upward pressure on prices and rents. It does not guarantee price rises. Rates, incomes and borrowing power also matter.",
        "For buyers, the deposit has moved further away. In a separate decade-long comparison, the modelled time to save a 20% deposit rose from 9 years in 2015 to 11.2 in 2025.",
        "High costs and labour shortages slow building. Building more is not the same as catching up. To close the shortage, homes added after demolitions must outpace additional need.",
        "The 18-month gap is not the total accumulated shortage. Need reflects household formation, not spending power. The deposit model assumes saving 15% of gross median household income each year for a median-priced dwelling. It is not an observed wait or a minimum deposit requirement.",
      ],
      source:
        "Sources: NHSAC 2026, pp. 3, 21, 54, 57; RBA (2019). Illustrative photography credited on screen.",
      read: "housingBalance",
    }),
  };
}
