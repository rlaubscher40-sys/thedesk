import { createHash } from "node:crypto";
import type { LaunchPostId } from "../../shared/instagramLaunch";
import { featuredComparison } from "../../shared/featuredComparison";
import type { MarketDirectory } from "../../shared/marketDirectory";
import { featuredComparisonCardInput } from "../core/marketSeo";
import type { DeskTakeCardInput } from "../og/takeCard";

type LaunchSlide = { title: string; body: string };
export type LaunchContent = {
  id: LaunchPostId;
  title: string;
  caption: string;
  slides: LaunchSlide[];
  comparison?: DeskTakeCardInput;
};

const intro: LaunchSlide[] = [
  {
    title: "Property changes. Know what matters.",
    body: "Australian property intelligence before consensus.",
  },
  { title: "What changed?", body: "Follow Australian property reporting and recorded signals." },
  { title: "Why does it matter?", body: "Read the evidence and The Desk Take." },
  {
    title: "What would change the view?",
    body: "Inspect the risks, source trail and missing facts.",
  },
  {
    title: "Start with Brisbane vs Perth.",
    body: "Open The Desk through our bio. Go to Markets for the free comparison.",
  },
];
const how: LaunchSlide[] = [
  {
    title: "From a number to a better question.",
    body: "Open The Desk through our bio. Go to Markets, then Brisbane vs Perth.",
  },
  {
    title: "Read the rental comparison.",
    body: "Check the official figures, the reference month and what the measure includes.",
  },
  { title: "Inspect the source trail.", body: "See what is missing from the wider market call." },
  {
    title: "Ask the next question.",
    body: "Build a wider intelligence brief. A question allowance applies; weak evidence can mean no call.",
  },
  {
    title: "Share the free read.",
    body: "Send it to someone weighing up the same markets. No account or question allowance needed to read it.",
  },
];

export function buildLaunchContent(id: LaunchPostId, directory?: MarketDirectory): LaunchContent {
  if (id === "start")
    return {
      id,
      title: "Start here",
      slides: intro,
      caption:
        "Property decisions start with better questions. What changed? Why does it matter? What would make us rethink the view?\n\nThe Desk brings Australian property reporting and recorded signals into one place, with sources and evidence gaps visible.\n\nStart with our free Brisbane–Perth comparison. Then explore a market, save a signal or ask the next question.\n\nOpen The Desk through our bio, then tap Markets.",
    };
  if (id === "how")
    return {
      id,
      title: "How to use The Desk",
      slides: how,
      caption:
        "Start with the answer, then inspect it.\n\nOur Brisbane–Perth read shows one comparable measure, its sources and the evidence still needed for a wider market decision. The first read needs no account or question allowance.\n\nOpen The Desk through our bio and tap Markets. Which missing piece would you want to see next?",
    };
  if (!directory) throw new Error("Current ABS comparison evidence is unavailable.");
  const comparison = featuredComparisonCardInput(directory);
  if (!comparison)
    throw new Error("Current, matching ABS observations are required before posting.");
  const read = featuredComparison(directory);
  return {
    id,
    title: "Brisbane vs Perth",
    slides: [],
    comparison,
    caption: `${read.summary}\n\n${comparison.take} The gap is ${comparison.figure} (percentage points).\n\n${comparison.context}\n\nOpen the free comparison for the figures, sources and missing pieces. Visit The Desk through our bio, then tap Markets.\n\nSource: Australian Bureau of Statistics, CPI rents, original series.`,
  };
}

/** Binds publication to reviewed copy/data, excluding non-semantic JPEG grain. */
export function launchContentHash(content: LaunchContent): string {
  return createHash("sha256")
    .update(JSON.stringify({ layout: 1, content }))
    .digest("hex");
}
