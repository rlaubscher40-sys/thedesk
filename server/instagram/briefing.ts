import type { DailyFeedItem } from "../db/schema";
import { sourceTimingLabel } from "../../shared/sourceTiming";
import { storyDestination } from "./sourceContent";
import { captionBeat, captionText, composeEditorialCaption } from "./editorialCaption";
import { needsPreviousContext } from "../../shared/headline";
import { guideForStory } from "../../shared/propertyGuides";

/** Source copy and reusable explanations have separate roles. No social model call. */
const briefingText = (s: string) => s.replace(/[–—]/g, ", ").replace(/\s+/g, " ").trim();
export type BriefingLens = {
  key:
    | "estimate"
    | "stress"
    | "supply"
    | "tenure"
    | "tenancy"
    | "planning"
    | "rents"
    | "loans"
    | "auction"
    | "general";
  title: string;
  meaning: string;
  points: Array<{ label: string; detail: string }>;
  takeaway: string;
};
export function briefingLens(story: Pick<DailyFeedItem, "title" | "summary">): BriefingLens {
  const full = `${story.title} ${story.summary ?? ""}`;
  if (/\b(?:public|social|affordable) (?:housing|homes)|\bmarket-rate\b/i.test(story.title))
    return {
      key: "tenure",
      title: "The housing mix matters.",
      meaning:
        "Market-rate rentals, affordable housing and public housing serve different needs. A total dwelling count does not establish how many public homes are guaranteed.",
      points: [
        { label: "Tenure", detail: "Public, affordable or market-rate" },
        { label: "Commitment", detail: "Proposed or guaranteed homes" },
        { label: "Delivery", detail: "Replacement homes and timing" },
      ],
      takeaway:
        "Check the committed housing mix, replacement provision and delivery timetable in the proposal.",
    };
  if (
    /\b(?:evict\w*|rental (?:reform|law|rights)|tenan\w* (?:rights|protections)|lease (?:rules|reform))\b/i.test(
      story.title
    )
  )
    return {
      key: "tenancy",
      title: "A proposal is not a rule in force.",
      meaning:
        "Rental rights depend on the jurisdiction, the final rules and their commencement date. An announcement alone does not change every lease.",
      points: [
        { label: "Place", detail: "The jurisdiction covered" },
        { label: "Status", detail: "Proposal or enacted rule" },
        { label: "Start", detail: "Commencement and affected leases" },
      ],
      takeaway:
        "Read the final rules, start date and lease coverage before applying the change to a tenancy.",
    };
  if (
    /\b(?:redevelop\w*|tower plans?|planning (?:proposal|controls)|rezon\w*)\b/i.test(story.title)
  )
    return {
      key: "planning",
      title: "Follow the proposal through its stages.",
      meaning:
        "A redevelopment or planning proposal can change during assessment. Proposed homes, approved homes and completed homes are separate stages.",
      points: [
        { label: "Proposal", detail: "The scope being considered" },
        { label: "Decision", detail: "Consent and conditions" },
        { label: "Delivery", detail: "Construction and completion" },
      ],
      takeaway: "Check the latest decision, conditions and delivery commitments for this site.",
    };
  if (/\b(modell?ing|forecast\w*|projected|projections?|predict\w*)\b/i.test(full))
    return {
      key: "estimate",
      title: "A projection is not an outcome.",
      meaning:
        "Modelling describes a result under particular assumptions. It does not establish what has already happened or what must happen next.",
      points: [
        { label: "Assumptions", detail: "What the model holds fixed" },
        { label: "Scenario", detail: "The change it tests" },
        { label: "Estimate", detail: "The projected result" },
      ],
      takeaway: "Read the scenario, timeframe and assumptions alongside the headline number.",
    };
  // Prefer the headline's subject; a passing mention in the summary must not
  // turn a lending or supply story into a rent explainer.
  const topic =
    /\b(approv\w*|commencements?|completions?|construction|new homes|auction|clearance|rents?|rental\w*|tenan\w*|cash rate|interest rates?|RBA|Reserve Bank|mortgage\w*|home loans?)\b/i;
  const text = topic.test(story.title) ? story.title : full;
  if (
    /\b(mortgage stress|financial strain)\b/i.test(full) &&
    /\b(approv\w*|new homes|housing supply)\b/i.test(full)
  )
    return {
      key: "stress",
      title: "Same place. Different pressures.",
      meaning:
        "Housing approvals and mortgage stress describe different things. An overlap between them does not establish that one causes the other.",
      points: [
        { label: "New supply", detail: "The housing supply measure" },
        { label: "Existing pressure", detail: "Borrowers under financial strain" },
        { label: "The overlap", detail: "A shared location, not proof of cause" },
      ],
      takeaway:
        "Separate the local supply pipeline from household repayment pressure. One figure cannot explain both.",
    };
  if (/\b(approvals?|approved|commencements?|completions?|construction|new homes)\b/i.test(text))
    return {
      key: "supply",
      title: "Permission. Construction. Completion.",
      meaning:
        "Building approvals permit construction; planning approval can be an earlier step. Starts and completions measure later stages.",
      points: [
        { label: "Approved", detail: "Planning or building permission" },
        { label: "Started", detail: "Construction has begun" },
        { label: "Completed", detail: "Building work is finished" },
      ],
      takeaway:
        "For the supply outlook, follow starts and completions alongside approvals in the same area.",
    };
  if (/\b(auction|clearance)\b/i.test(text))
    return {
      key: "auction",
      title: "A rate needs a denominator.",
      meaning:
        "A clearance percentage alone leaves out how many auctions were held and how many results were reported.",
      points: [
        { label: "Volume", detail: "How many auctions?" },
        { label: "Coverage", detail: "How many reported results?" },
        { label: "Status", detail: "Preliminary or final?" },
      ],
      takeaway:
        "Compare the same market and reporting stage before treating one weekend as a trend.",
    };
  if (
    /\b(?:rent(?:s|al)? (?:levels?|growth|prices?|rose|rise|rising|fell|fall|falling|increas\w*|decreas\w*|index)|(?:asking|median|weekly) rents?)\b/i.test(
      text
    )
  )
    return {
      key: "rents",
      title: "The price and the pace are different.",
      meaning:
        "Rent levels and rent growth answer different questions. Slower positive growth still means rents are rising; a negative change means they fell over that period.",
      points: [
        { label: "Level", detail: "The dollar rent" },
        { label: "Change", detail: "Movement over a period" },
        { label: "Coverage", detail: "Asking rents or rents paid?" },
      ],
      takeaway:
        "Match the location, property type and rent measure before comparing rental markets.",
    };
  if (/\b(cash rate|interest rates?|RBA|Reserve Bank|mortgage\w*|home loans?)\b/i.test(text))
    return {
      key: "loans",
      title: "One rate does not tell the whole story.",
      meaning:
        "The RBA cash rate and a home-loan rate are different measures. Repayments also depend on the loan balance and term.",
      points: [
        { label: "Cash rate", detail: "The RBA policy benchmark" },
        { label: "Loan rate", detail: "The rate on the loan" },
        { label: "Repayment", detail: "Balance and term also matter" },
      ],
      takeaway:
        "Use the actual loan rate, balance and remaining term when comparing repayment examples.",
    };
  return {
    key: "general",
    title: "The detail behind the headline.",
    meaning:
      "A national headline can describe a different market from the property you are watching.",
    points: [
      { label: "Where", detail: "The area covered" },
      { label: "What", detail: "The property or measure" },
      { label: "When", detail: "The reporting period" },
    ],
    takeaway:
      "Keep the location, measure and period together when comparing this update with local evidence.",
  };
}

/** Never cut a sentence or split a figure from its qualifier to fill a card.
 * A long summary is only shortened at its FIRST complete sentence. No ranking
 * of isolated dramatic clauses; cached/generated angles never enter this path. */
export function briefingDetail(story: Pick<DailyFeedItem, "title" | "summary">): string | null {
  const summary = briefingText(story.summary ?? "");
  if (needsPreviousContext(summary)) return null;
  if (/^(?:Media contact|Published by)\b/i.test(summary)) return null;
  const ministerialLead = /^(?:Deputy Premier|Minister for|The Honourable)\b/i.test(summary);
  const reportsAction =
    /\b(?:announc\w*|approv\w*|confirm\w*|said|says|releas\w*|introduc\w*|unveil\w*|commit\w*|report\w*)\b/i.test(
      summary
    );
  if (ministerialLead && !reportsAction) return null;
  // Do not present an approvals count as completed homes, even if the feed
  // copied an ambiguous publisher sentence. Another eligible story can lead.
  if (/\bnew homes approved\b[^.!?]*\bwere built\b/i.test(summary)) return null;
  if (!summary || summary.toLowerCase() === briefingText(story.title).toLowerCase()) return null;
  if (summary.length <= 420) return summary;
  const sentences = [...new Intl.Segmenter("en-AU", { granularity: "sentence" }).segment(summary)];
  const first = sentences[0]?.segment.trim();
  return first && first.length <= 420 && /[.!?][”"']?$/.test(first) ? first : null;
}
export function briefingClaimLabel(story: Pick<DailyFeedItem, "title" | "summary">): string {
  return /\b(modell?ing|forecast\w*|projected|projections?|predict\w*)\b/i.test(
    `${story.title} ${story.summary ?? ""}`
  )
    ? "REPORTED ESTIMATE"
    : "REPORTED FINDING";
}
export function briefingReady(story: DailyFeedItem): boolean {
  return briefingText(story.title).length <= 170 && !!briefingDetail(story);
}
export type BriefingSlide = {
  kind: "cover" | "evidence" | "explainer" | "supporting" | "takeaway";
  story: DailyFeedItem;
  title: string;
  body: string;
  lens: BriefingLens;
};
export function buildBriefingSlides(stories: DailyFeedItem[]): BriefingSlide[] {
  const lead = stories[0];
  if (!lead || !stories.every(briefingReady))
    throw new Error("Briefing needs readable source headlines and usable source detail");
  const lens = briefingLens(lead);
  return [
    {
      kind: "cover",
      story: lead,
      title: lens.key === "stress" ? "New homes.\nStretched borrowers." : briefingText(lead.title),
      body: "The finding. The context. What to watch.",
      lens,
    },
    {
      kind: "evidence",
      story: lead,
      title: "What the report says",
      body: briefingDetail(lead)!,
      lens,
    },
    { kind: "explainer", story: lead, title: lens.title, body: lens.meaning, lens },
    ...stories.slice(1, 3).map((story) => ({
      kind: "supporting" as const,
      story,
      title: briefingText(story.title),
      body: briefingDetail(story)!,
      lens: briefingLens(story),
    })),
    { kind: "takeaway", story: lead, title: "What to watch next", body: lens.takeaway, lens },
  ];
}
export function briefingAlt(slide: BriefingSlide, index: number, count: number): string {
  return briefingText(
    [
      `${index + 1} of ${count}.`,
      slide.title,
      slide.body,
      briefingClaimLabel(slide.story),
      ...(slide.kind === "explainer"
        ? ["General reading guide.", ...slide.lens.points.map((p) => `${p.label}: ${p.detail}.`)]
        : []),
      `Source: ${slide.story.source}. Briefing date: ${slide.story.feedDate}.`,
    ].join(" ")
  );
}
export function briefingCaption(stories: DailyFeedItem[]): string {
  const lead = stories[0];
  if (!lead) throw new Error("No briefing stories");
  if (stories.slice(0, 3).some((story) => !story.title.trim() || !story.source?.trim()))
    throw new Error("Briefing caption needs source-attributed stories");
  const lens = briefingLens(lead);
  const detail = briefingDetail(lead);
  if (!detail) throw new Error("Briefing caption needs usable source detail");
  const references = stories
    .slice(0, 3)
    .flatMap((story, i) => [
      ...(i ? [`${i + 1}. ${captionText(story.title)}`] : []),
      `Source: ${briefingText(story.source)} · Briefing ${story.feedDate}`,
      sourceTimingLabel(story.sourceTiming),
      `Read story ${story.id}: ${storyDestination(story)}`,
    ]);
  return composeEditorialCaption({
    hook: captionText(lead.title),
    paragraphs: [`${captionText(lead.source)} reports: ${detail}`, `Context: ${lens.meaning}`],
    action: lens.takeaway,
    destination: `Sources and full stories: bio → Recent carousel stories.\nProperty explained: thedesk.au/guides${guideForStory(lead.title, lead.channel) ? `/${guideForStory(lead.title, lead.channel)!.slug}` : ""}`,
    references,
    notes: stories.slice(0, 3).some((story) => briefingClaimLabel(story) === "REPORTED ESTIMATE")
      ? ["Modelled figures are reported estimates, not established outcomes."]
      : [],
    beat: captionBeat(lead.title),
    hookLimit: 170,
  });
}
