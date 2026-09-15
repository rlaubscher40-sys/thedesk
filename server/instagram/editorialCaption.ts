import { assertCaptionStyle, CaptionStyleError } from "./captionStyle";

/** Caption copy is assembled from checked inputs, never generated at publish time. */
export type CaptionBeat =
  | "property"
  | "supply"
  | "rents"
  | "loans"
  | "auction"
  | "population"
  | "history"
  | "business"
  | "tech"
  | "science"
  | "world";

const TAGS: Record<CaptionBeat, string> = {
  property: "#PropertyMarket",
  supply: "#HousingSupply",
  rents: "#RentalMarket",
  loans: "#HomeLoans",
  auction: "#Auctions",
  population: "#Population",
  history: "#PropertyHistory",
  business: "#BusinessNews",
  tech: "#TechNews",
  science: "#ScienceNews",
  world: "#WorldNews",
};

/** Match the actual headline, not a passing reference in a summary or hashtag. */
export function captionBeat(title: string): CaptionBeat {
  if (/\b(migrat\w*|population|interstate)\b/i.test(title)) return "population";
  if (
    /\b(mortgage\w*|home loans?|lending|RBA|cash rate|interest rates?|refinanc\w*)\b/i.test(title)
  )
    return "loans";
  if (/\b(auction\w*|clearance)\b/i.test(title)) return "auction";
  if (
    /\b(approvals?|completions?|construction|housing supply|new homes?|dwellings?)\b/i.test(title)
  )
    return "supply";
  if (/\b(rents?|rental\w*|vacanc\w*|tenan\w*)\b/i.test(title)) return "rents";
  return "property";
}

/** A useful reading task, not a request to like, tag and follow every post. */
export function captionAction(beat: CaptionBeat): string {
  switch (beat) {
    case "supply":
      return "Keep approvals, starts and completions separate when comparing local supply.";
    case "rents":
      return "Compare the same rent measure, property type and period in the areas you follow.";
    case "loans":
      return "Save the rate, balance and term together for your next loan comparison.";
    case "auction":
      return "Compare auction volume and reporting coverage alongside the clearance rate.";
    case "population":
      return "Look at local household growth alongside the homes being completed.";
    default:
      return "Keep the source and reporting period with the figure when comparing markets.";
  }
}

/** Preserve numbers, acronyms, names, URLs and ranges. Only remove em dashes. */
export function captionText(text: string): string {
  return text
    .split(/(https?:\/\/\S+)/)
    .map((part, i) => (i % 2 ? part : part.replace(/\u2014/g, ", ").replace(/[\t ]+/g, " ")))
    .join("")
    .trim();
}

export function captionSentence(text: string): string {
  const value = captionText(text);
  return value && !/[.!?][”"']?$/.test(value) ? `${value}.` : value;
}

/** Only the known machine-generated display vocabulary is lowercased.
 * An unfamiliar all-caps source name/qualifier is safer unchanged. */
export function captionClaim(text: string): string {
  const words =
    /\b(RECORDED|READINGS|READING|FALLS|RISES|IN|A|ROW|HIGHEST|LOWEST|OF|BETWEEN|THE|MEDIAN|MOVE|CROSSED|BELOW|ABOVE|LATEST|ON|FILE|FIRST|MONTHS|MONTH|ITS|USUAL|MOVED|THIS|BIGGEST|FALL|RISE|SINCE|WE|STARTED|TRACKING|ZERO|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)\b/g;
  const value = captionText(text)
    .replace(words, (word) => word.toLowerCase())
    .replace(/(?<=\d)PP\b|\bPP\b/g, "pp");
  return captionSentence(value.charAt(0).toUpperCase() + value.slice(1));
}

export type EditorialCaption = {
  hook: string;
  paragraphs: readonly string[];
  action: string;
  references: readonly string[];
  beat: CaptionBeat;
  destination?: string;
  notes?: readonly string[];
  disclosure?: string;
  limit?: number;
  hookLimit?: number;
};

/** Shared by every automatic format. No clipping, filler model calls or fallback
 * that loses a source/qualification. A failed contract holds this post. */
export function composeEditorialCaption(input: EditorialCaption): string {
  const required = [input.hook, input.action, ...input.paragraphs, ...input.references];
  if (
    !input.paragraphs.length ||
    !input.references.length ||
    required.some((value) => !value.trim())
  )
    throw new CaptionStyleError(
      "Caption needs a hook, story, useful action and source references."
    );
  if (input.hook.trim().length > (input.hookLimit ?? 200) || /[\r\n]/.test(input.hook))
    throw new CaptionStyleError(
      "Caption opening needs a shorter complete headline; no factual truncation allowed."
    );
  const story = [input.hook, ...input.paragraphs, input.action].map(captionText);
  const uniqueStory = story.filter((value, i) => story.indexOf(value) === i);
  const broad = ["business", "tech", "science", "world"].includes(input.beat);
  const caption = [
    ...uniqueStory,
    input.destination,
    ...(input.notes ?? []),
    input.references.map(captionText).join("\n"),
    input.disclosure,
    `${broad ? "#NewsBriefing" : "#AusProperty"} ${TAGS[input.beat]} #TheDesk`,
  ]
    .filter((value): value is string => !!value?.trim())
    .map(captionText)
    .join("\n\n");
  if (caption.length > Math.min(input.limit ?? 2200, 2200))
    throw new CaptionStyleError(
      "Caption exceeds editorial length limit; no factual truncation allowed."
    );
  return assertCaptionStyle(caption);
}
