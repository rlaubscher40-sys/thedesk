import { SOCIAL_DESTINATIONS } from "../../shared/socialDestinations";
import { composeEditorialCaption, type CaptionBeat } from "./editorialCaption";

export const REEL_READS = {
  rentComparison: SOCIAL_DESTINATIONS[0],
  sydneyRent: SOCIAL_DESTINATIONS[1],
  sydneySupply: SOCIAL_DESTINATIONS[2],
  supplyComparison: SOCIAL_DESTINATIONS[3],
  housingBalance: SOCIAL_DESTINATIONS[4],
  newLoanRates: SOCIAL_DESTINATIONS[5],
  interstateMigration: SOCIAL_DESTINATIONS[6],
  capitalRents: { label: "All eight capital-city rent figures", path: "/social" },
} as const;
export const REEL_CAPTION_LIMIT = 1400;
const BEATS: Record<keyof typeof REEL_READS, CaptionBeat> = {
  rentComparison: "rents",
  sydneyRent: "rents",
  capitalRents: "rents",
  sydneySupply: "supply",
  supplyComparison: "supply",
  housingBalance: "supply",
  newLoanRates: "loans",
  interstateMigration: "population",
};

/** Narrative captions keep the source and material caveats without exposing pipeline metadata. */
export function buildNarrativeReelCaption(input: {
  paragraphs: string[];
  source: string;
  revision?: string;
  read: keyof typeof REEL_READS;
}) {
  if (!Object.hasOwn(REEL_READS, input.read)) throw new Error("Unknown Reel read");
  const fields = [...input.paragraphs, input.source, ...(input.revision ? [input.revision] : [])];
  if (
    input.paragraphs.length < 3 ||
    input.paragraphs.length > 6 ||
    !input.paragraphs[0] ||
    input.paragraphs[0].length > 110 ||
    fields.some((p) => !p.trim() || /https?:\/\/|#[\w-]/i.test(p))
  )
    throw new Error("Narrative caption requires complete plain-text editorial fields");
  return composeEditorialCaption({
    hook: input.paragraphs[0]!,
    paragraphs: input.paragraphs.slice(1),
    action: `Full comparison and sources: link in bio → ${REEL_READS[input.read].label}.`,
    references: [input.source, ...(input.revision ? [input.revision] : [])],
    disclosure: "AI narration.",
    beat: BEATS[input.read],
    limit: REEL_CAPTION_LIMIT,
    hookLimit: 110,
  });
}

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
  newLoanRates: "new_home_loan_rates",
  interstateMigration: "interstate_migration",
  rentComparison: "property_editorial_reel",
  sydneyRent: "sydney_rent_change",
  sydneySupply: "sydney_before_buy",
  supplyComparison: "supply_comparison",
  capitalRents: "eight_capital_rents",
  housingBalance: "national_housing_balance",
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
  return composeEditorialCaption({
    hook: input.hook,
    paragraphs: [input.finding, input.meaning],
    action: input.action,
    destination: `Bio → ${reading.label}${/[.!?]$/.test(reading.label) ? "" : "."} Figures, definitions and source links:\n${url}`,
    references: [
      input.method,
      input.revisions,
      "Source pages update; match the post's reference period.",
    ],
    disclosure: "AI narration.",
    beat: BEATS[input.read],
    limit: REEL_CAPTION_LIMIT,
    hookLimit: 110,
  });
}
