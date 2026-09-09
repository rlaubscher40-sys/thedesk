import { SOCIAL_DESTINATIONS } from "../../shared/socialDestinations";

export const REEL_READS = {
  rentComparison: SOCIAL_DESTINATIONS[0],
  sydneyRent: SOCIAL_DESTINATIONS[1],
  sydneySupply: SOCIAL_DESTINATIONS[2],
  supplyComparison: SOCIAL_DESTINATIONS[3],
  capitalRents: { label: "All eight capital-city rent figures", path: "/social" },
} as const;
export const REEL_CAPTION_LIMIT = 1400;

/** The spoken ending and video card name the same visible link as the caption. */
export function reelReadingCta(read: keyof typeof REEL_READS) {
  const destination = REEL_READS[read];
  if (!destination || !Object.hasOwn(REEL_READS, read)) throw new Error("Unknown Reel read");
  return {
    voice: `Open our bio. Choose ${destination.label}${/[.!?]$/.test(destination.label) ? "" : "."}`,
    fact: { figure: "Open our bio", caption: destination.label },
  };
}
const CAMPAIGNS = {
  rentComparison: "property_editorial_reel",
  sydneyRent: "sydney_rent_change",
  sydneySupply: "sydney_before_buy",
  supplyComparison: "supply_comparison",
  capitalRents: "eight_capital_rents",
} as const;

/** Fixed editorial copy, not another model call. Never truncate a source claim. */
export function buildReelCaption(input: {
  hook: string;
  finding: string;
  meaning: string;
  method: string;
  revisions: string;
  action: string;
  read: keyof typeof REEL_READS;
}) {
  const reading = REEL_READS[input.read];
  if (!reading || !Object.hasOwn(REEL_READS, input.read)) throw new Error("Unknown Reel read");
  if (input.hook.length > 110) throw new Error("Reel hook is too long");
  const paragraphs = [
    input.hook,
    input.finding,
    input.meaning,
    input.method,
    input.revisions,
    input.action,
  ];
  if (paragraphs.some((p) => !p.trim() || /https?:\/\/|#[\w-]/i.test(p)))
    throw new Error("Reel caption requires complete plain-text editorial fields");
  // Caption fragments such as #housing-approvals become stray Instagram hashtags.
  // Bio links retain their anchors; the printable URL opens the same public page.
  const url = new URL(reading.path.split("#")[0]!, "https://thedesk.au");
  url.searchParams.set("utm_source", "instagram");
  url.searchParams.set("utm_medium", "reel");
  url.searchParams.set("utm_campaign", CAMPAIGNS[input.read]);
  const caption = [
    ...paragraphs.map((p) => p.trim()),
    `Bio → ${reading.label}. Figures, definitions and ABS source links:\n${url}`,
    "Source pages update; match the post's reference period.",
    "Synthetic male narration: Kokoro / George.\n#AusProperty #PropertyData #TheDesk",
  ].join("\n\n");
  if (caption.length > REEL_CAPTION_LIMIT)
    throw new Error("Reel caption exceeds editorial length limit; no factual truncation allowed");
  return caption;
}
