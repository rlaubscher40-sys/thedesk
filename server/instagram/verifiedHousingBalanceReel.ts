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
        "Why is a home so hard to afford? Part of the answer is that supply is falling behind demand.",
        `From July 2024 to December 2025, Australia added about ${number(balance.net)} homes after demolitions. Estimated extra need: ${number(balance.demand)}. An additional gap of about ${number(balance.shortfall)} homes.`,
        "When demand outpaces supply, it puts upward pressure on prices and rents. Higher costs can mean delaying a home of your own. The Council links housing and living costs to adult children staying home longer.",
        "Catching up takes time. High construction costs and shortages of skilled labour hold building back.",
        "The takeaway: easing this pressure needs supply to catch up with demand. A shortage does not guarantee rising prices. Interest rates, incomes and borrowing power also shape demand.",
        "These approximate national flows are not Australia's total accumulated shortage or a count of homeless households. Housing need is modelled from household formation, not buyers' spending power.",
      ],
      source:
        "Sources: NHSAC, State of the Housing System 2026, ch. 2; RBA, A Model of the Australian Housing Market (2019).",
      read: "housingBalance",
    }),
  };
}
