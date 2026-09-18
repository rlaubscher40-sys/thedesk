import type { InstagramPostType } from "../../shared/const";
import { assertCaptionStyle } from "./captionStyle";

/** Editorial questions only: no generated facts, invented attribution or extra LLM call.
 * Match the published lead headline, not unrelated stories or caption hashtags. */
export function buildFirstComment(input: {
  postType: InstagramPostType;
  headline?: string | null;
}) {
  const headline = input.headline ?? "";
  const themes: Array<[RegExp, string]> = [
    [
      /\b(?:public|social|affordable) (?:housing|homes)|\bmarket-rate\b/i,
      "Which part of this housing proposal needs more explanation: the housing mix, replacement homes or delivery timetable?",
    ],
    [
      /\b(?:evict\w*|rental (?:reform|law|rights)|tenan\w* (?:rights|protections)|lease (?:rules|reform))\b/i,
      "Which part of the rental rules would you like explained: who is covered, what changes or when they start?",
    ],
    [
      /\b(?:redevelop\w*|tower plans?|planning (?:proposal|controls)|rezon\w*)\b/i,
      "What would you like explained about this proposal: its scope, approval stage or delivery commitments?",
    ],
    [
      /\b(migrat\w*|population|interstate)\b/i,
      "When people move into an area, what changes first where you live: rents, available homes or prices?",
    ],
    [
      /\b(mortgage\w*|loans?|lending|rba|cash rate|interest rates?|refinanc\w*)\b/i,
      "When comparing home loans, what would you like explained next: the rate, fees or borrowing capacity?",
    ],

    [
      /\b(approvals?|completions?|construction|housing supply|new homes?(?!\s+loans?\b)|dwellings?|housing balance)\b/i,
      "What would make the biggest difference to new housing in your area: approvals, infrastructure or construction costs?",
    ],
    [
      /\b(rents?|rental\w*|vacanc\w*|tenan\w*)\b/i,
      "What are you seeing in your local rental market: more choice, fewer listings or little change?",
    ],
    [
      /\b(auction\w*|clearance)\b/i,
      "At auctions near you, are you seeing more bidders, more pass-ins or little change?",
    ],
    [
      /\b(affordab\w*|deposit\w*|first.home)\b/i,
      "What is the biggest hurdle to buying in your area: the deposit, repayments or finding a suitable home?",
    ],
    [
      /\b(house prices?|home prices?|property prices?|values?)\b/i,
      "Do these figures match what you are seeing locally? Tell us the area and what has changed.",
    ],
  ];
  const themed = themes.find(([pattern]) => pattern.test(headline))?.[1];
  const fallback =
    input.postType === "monthly"
      ? "Which figure in this month's review would you like us to unpack next?"
      : input.postType === "weekly" || input.postType === "daily"
        ? "Which story in this briefing deserves a deeper explanation, and what would you like to understand?"
        : input.postType === "launch"
          ? "Which Australian property question would you like The Desk to investigate?"
          : "Which part of this post would you like us to explain in more detail?";
  return validateFirstComment(themed ?? fallback);
}

export function validateFirstComment(message: string) {
  if (
    !message.trim() ||
    message !== message.trim() ||
    [...message].length > 300 ||
    /https?:\/\/|[@#]|[\r\n]/i.test(message)
  )
    throw new Error(
      "First comment must be plain text, at most 300 characters, without links or tags."
    );
  return assertCaptionStyle(message);
}
