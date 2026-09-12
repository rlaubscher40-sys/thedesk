import { z } from "zod";
import { hasHousingEvidence } from "./marketRelevance";
import { looksLikeGarbage, looksLikeSiteBoilerplate } from "./headline";
import { sourceTimingHold, type SourceTiming } from "./sourceTiming";
import { storyChannel } from "./storyGeography";
import { storySignificance } from "./editorialSignificance";

export const EDITORIAL_VERSION = "2026-09-10-v4";
export type EditorialInput = {
  title: string;
  summary?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
  category?: string | null;
  channel?: string | null;
  articleText?: string | null;
  sourceTiming?: SourceTiming | null;
};
export function publisherHost(input: EditorialInput): string {
  try {
    return new URL(input.sourceUrl ?? input.url ?? "").hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
const primary = new Set([
  "rba.gov.au",
  "abs.gov.au",
  "apra.gov.au",
  "asic.gov.au",
  "treasury.gov.au",
  "ministers.treasury.gov.au",
  "ato.gov.au",
]);
const specialist = new Set([
  "theadviser.com.au",
  "mpamag.com",
  "brokernews.com.au",
  "professionalplanner.com.au",
  "accountantsdaily.com.au",
  "proptrack.com.au",
  "cotality.com",
  "corelogic.com.au",
  "sqmresearch.com.au",
  "housingaustralia.gov.au",
  "ahuri.edu.au",
  "nhsac.gov.au",
]);
const newsroom = new Set([
  "abc.net.au",
  "theguardian.com",
  "afr.com",
  "reuters.com",
  "smh.com.au",
  "theage.com.au",
  "theconversation.com",
  "realestate.com.au",
  "domain.com.au",
]);
// Useful original statements, but an industry position is not corroboration
// of its own claims. Keep below official releases and specialist reporting.
const industryBody = new Set(["smsfassociation.com", "udia.com.au", "masterbuilders.com.au"]);
export function publisherWeight(input: EditorialInput): number {
  const host = publisherHost(input);
  return primary.has(host)
    ? 16
    : specialist.has(host)
      ? 12
      : newsroom.has(host) || industryBody.has(host)
        ? 8
        : host.endsWith(".gov.au")
          ? 5
          : 0;
}

/** Page types are evidence/reference material, not automatically a dated news event. */
export function referenceNewsHold(input: EditorialInput): string | null {
  const title = input.title.trim();
  // A rolling national-news page is not a housing article. In particular,
  // "housing nuclear activities" means containing, not residential supply.
  if (/\b(?:australia|national|world|breaking) news\s+live\b/i.test(title))
    return "general-news-liveblog";
  if (
    /\b(?:that'?s where we(?:'ll| will) leave|that'?s all (?:from|for)|thanks for (?:joining|following))\b/i.test(
      (input.summary ?? "").replace(/’/g, "'")
    )
  )
    return "liveblog-signoff";
  if (
    (/\bwhat sets this\b.{0,100}\bapart for buyers\b/i.test(title) &&
      /\b(?:luxury|landmark|apartments?|development)\b/i.test(title)) ||
    /\bsnappy \$[\d,.]+\s*(?:m|million)\s+sale in\b/i.test(title)
  )
    return "individual-property-promotion";
  if (
    /\b(?:appoint(?:ed|ment)|welcomes)\b.*\b(?:chair|board member|chief executive|CEO)\b/i.test(
      title
    )
  )
    return "reference-or-staff-profile";
  if (
    /\b(book your (?:hotel|room|ticket)|awards 20\d{2}|audit day 20\d{2}|register now|early.bird|sponsored|advertorial|webinar)\b/i.test(
      title
    )
  )
    return "promotion-or-event-marketing";
  if (
    /\b(film review|movie review|this Australian film|film takes a swipe|cinema review)\b/i.test(
      title
    )
  )
    return "culture-not-market-reporting";
  if (
    /\b(buy ratings?|best returns|moving average|stocks? to (?:buy|watch)|shares? to (?:buy|watch)|top \d+ .*shares?)\b/i.test(
      title
    )
  )
    return "stock-pick-roundup";
  if (
    /^(tender details|commission communiqu[eé]|attorney general'?s department|home|news|media releases?)$/i.test(
      title
    )
  )
    return "reference-page";
  if (
    /\b(for sale|dream home|inside (?:the|a)|luxury (?:home|mansion|penthouse)|celebrity home)\b/i.test(
      title
    ) &&
    !/\b(market|median|affordability|clearance|policy|tax)\b/i.test(title)
  )
    return "individual-property-promotion";
  if (
    /\b(temporary traffic changes|road closures?|roadworks|traffic diversions?)\b/i.test(title) &&
    !hasHousingEvidence(title)
  )
    return "traffic-not-housing";
  try {
    const url = new URL(input.sourceUrl ?? input.url ?? "");
    const path = url.pathname;
    if (
      url.hostname.replace(/^www\./, "") === "apra.gov.au" &&
      (/^\/news-and-publications\/meet-/.test(path) ||
        /^\/news-and-publications\/(?:quarterly-superannuation-product-statistics|quarterly-superannuation-industry-publication|quarterly-fund-level-statistics)\/?$/.test(
          path
        ))
    )
      return "reference-or-staff-profile";
    if (/\/tender\/details\/|\/plans-in-nsw\/|\/buy\/|\/rent\//i.test(path))
      return "reference-or-listing";
  } catch {
    /* The URL check at publication handles missing links. */
  }
  return null;
}
const macro =
  /\b(inflation|cash rate|interest rates?|rba|reserve bank|gdp|Australian economy|national accounts|productivity|construction workforce|employment|filled jobs|unemployment|wage growth|household spending|consumer (?:sentiment|confidence)|population growth|net overseas migration|lending standards|serviceability)\b/i;
const policy =
  /\b(negative gearing|land tax|stamp duty|capital gains|tenancy|rent(?:al)? (?:law|reform|cap)|housing (?:policy|reform)|first.home buyers?|deposit scheme)\b/i;
const accommodationPolicy =
  /\b(?:short[ -]stay|short[ -]term (?:rental|accommodation)|Airbnb)\b.{0,100}\b(?:levy|tax|bill|ban|regulat\w*)\b|\b(?:levy|tax|bill|ban|regulat\w*)\b.{0,100}\b(?:short[ -]stay|short[ -]term (?:rental|accommodation)|Airbnb)\b/i;
const industryRegulation =
  /\b(?:packaging|recycling|plastic waste)\b.{0,100}\b(?:laws?|reforms?|regulations?|standards?|mandates?)\b|\b(?:laws?|reforms?|regulations?|standards?|mandates?)\b.{0,100}\b(?:packaging|recycling|plastic waste)\b/i;
const advice =
  /\b(superannuation|smsfs?|contribution caps?|financial advi(?:sers?|sors?|ce)|advice (?:fees|firms)|tax (?:reform|deductions?|residency|system)|discretionary trusts?|division 7a|capital gains tax|income tax|CGT|GST|PAYG|transfer balance cap|mortgage brokers?|broker commissions?|mortgage fraud|loan fraud|fraudulent (?:home |mortgage )?loans?)\b/i;
const conduct =
  /\b(?:ASIC|Tax Practitioners Board|TPB)\b.{0,70}\b(?:ban\w*|sanctions?|licen\w*|enforc\w*)\b|\b(?:ban\w*|sanctions?|licen\w*|enforc\w*)\b.{0,70}\b(?:ASIC|Tax Practitioners Board|TPB)\b/i;
const markets = /\b(asx|australian shares|australian dollar|bond yields?)\b/i;
const noise =
  /\b(celebrity|obituary|sexual touching|gangsters?|shooting|murder|dingo|sheep (?:theft|stolen)|poetry|horoscope|casino|promo code)\b/i;
export function editorialBeat(text: string): string | null {
  if (advice.test(text) || conduct.test(text)) return "advice-tax";
  if (markets.test(text)) return "markets";
  if (policy.test(text) || accommodationPolicy.test(text) || industryRegulation.test(text))
    return "policy";
  if (
    /\b(?:DA|development|planning) approval\b.{0,100}\b(?:homes|housing|dwellings)\b/i.test(text) ||
    /\b(?:(?:new|social|affordable) homes|homes (?:built|delivered)|making way for more homes)\b/i.test(
      text
    )
  )
    return "supply";
  if (
    /\b(supply|approvals|completions|construction|rezoning|builder|housing target)\b/i.test(text) &&
    hasHousingEvidence(text)
  )
    return "supply";
  if (/\b(rents?|rental|vacanc(?:y|ies))\b/i.test(text) && hasHousingEvidence(text)) return "rents";
  if (
    hasHousingEvidence(text) ||
    /\b(?:homes?|houses?|properties|property|apartments?)\b.{0,50}\b(?:prices?|values?|market|declin(?:e|es|ing)|affordability|supply)\b/i.test(
      text
    ) ||
    /\b[0-9][0-9,]* (?:new |social |affordable )*(?:homes|dwellings|apartments)\b/i.test(text)
  )
    return "housing";
  if (macro.test(text)) return "rates-economy";
  return null;
}
export function discoveryScore(input: EditorialInput): number {
  const text = `${input.title} ${input.summary ?? ""}`;
  if (
    referenceNewsHold(input) ||
    (["AU", "PROPERTY"].includes(input.channel ?? "AU") && noise.test(input.title))
  )
    return -100;
  if (["AU", "PROPERTY"].includes(input.channel ?? "AU"))
    return editorialBeat(text) ? editorialPriority(input) : publisherWeight(input);
  return (editorialBeat(text) ? 40 : 0) + publisherWeight(input) + (/\d/.test(input.title) ? 3 : 0);
}

/** Publisher reputation breaks close ties; it cannot outweigh a stronger event. */
export function editorialPriority(input: EditorialInput): number {
  return storySignificance(input.title).baseline + Math.floor(publisherWeight(input) / 4);
}

/** The subject must be in the headline/dek. Only designated official releases
 * may use a generic interview/release title and establish their beat in the body. */
export function subjectBeat(input: EditorialInput): string | null {
  return (
    editorialBeat(`${input.title} ${input.summary ?? ""}`) ??
    (publisherWeight(input) === 16 ? editorialBeat((input.articleText ?? "").slice(0, 4500)) : null)
  );
}
export function localEditorialChannel(input: EditorialInput, beat = subjectBeat(input)): string {
  return input.channel === "PROPERTY" &&
    ["advice-tax", "markets", "rates-economy"].includes(beat ?? "")
    ? "AU"
    : (input.channel ?? "AU");
}

/** Repair recent reference/promotional entries and unrelated subjects. */
export function legacyEditorialHold(input: EditorialInput): string | null {
  const reference = referenceNewsHold(input);
  if (reference) return reference;
  if (!subjectBeat(input) && publisherWeight(input) !== 16) return "off-topic";
  return null;
}

/** Deterministic eligibility and significance, not a truth/confidence score. */
export function assessStory(input: EditorialInput, now = new Date(), feedDate?: string) {
  const text = (input.articleText ?? "").trim();
  const reporting = `${input.title}\n${input.summary ?? ""}\n${text.slice(0, 4500)}`;
  let channel = storyChannel({
    ...input,
    summary: `${input.summary ?? ""}\n${text.slice(0, 4500)}`,
  });
  const beat = subjectBeat(input);
  const reject = (reason: string) => ({
    eligible: false,
    reason,
    score: 0,
    beat,
    channel,
    category: input.category ?? "OTHER",
  });
  const reference = referenceNewsHold(input);
  if (reference) return reject(reference);
  if (!publisherHost(input) || publisherHost(input) === "news.google.com")
    return reject("unresolved-publisher");
  const local = ["AU", "PROPERTY"].includes(input.channel ?? "AU");
  if (local && noise.test(input.title)) return reject("off-topic");
  if (local && !["AU", "PROPERTY"].includes(channel)) return reject("outside-australian-brief");
  if (local && !beat) return reject("no-property-or-economic-consequence");
  const dateHold = sourceTimingHold(input.sourceTiming, now, feedDate);
  if (dateHold) return reject(dateHold);
  // A fresh search timestamp is not proof that a static webpage is new.
  if (local && input.sourceTiming?.publisherDateStatus !== "available")
    return reject("unconfirmed-publication-date");
  if (text.length < (publisherWeight(input) === 16 ? 300 : 650))
    return reject("insufficient-article-text");
  if (looksLikeGarbage(text) || looksLikeSiteBoilerplate(text))
    return reject("unusable-article-text");
  const category = local
    ? beat === "rates-economy"
      ? "MACRO"
      : beat === "markets"
        ? "MARKETS"
        : ["policy", "advice-tax"].includes(beat ?? "")
          ? "POLICY"
          : "PROPERTY"
    : (input.category ?? "OTHER");
  const material =
    /\b(announc|rais|cut|fell|fall|ris|releas|chang|approv|reject|warn|new |launch|collapse)/i.test(
      reporting
    );
  const evidenceScore = Math.min(
    95,
    45 +
      publisherWeight(input) +
      (beat ? 12 : 0) +
      (material ? 8 : 0) +
      (/\d/.test(reporting) ? 4 : 0) +
      (text.length >= 1800 ? 4 : 0)
  );
  if (local && publisherWeight(input) === 0) return reject("unreviewed-publisher");
  if (local && evidenceScore < 73) return reject("below-editorial-priority-floor");
  if (local) channel = localEditorialChannel({ ...input, channel }, beat);
  const score = local ? editorialPriority(input) : evidenceScore;
  return { eligible: true, reason: "eligible", score, beat, channel, category };
}

export const editorialReportSchema = z.object({
  version: z.literal(EDITORIAL_VERSION),
  runId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  status: z.enum(["preview", "published", "empty", "failed"]),
  discovered: z.number().int().nonnegative(),
  evidencePool: z.number().int().nonnegative(),
  inserted: z.number().int().nonnegative(),
  read: z.number().int().nonnegative(),
  selected: z.number().int().nonnegative(),
  /** Total decisions before the retained 300-entry sample; absent on older runs. */
  decisionCount: z.number().int().nonnegative().optional(),
  sources: z
    .array(
      z.object({
        name: z.string().max(160),
        url: z.string().url().max(2048),
        fetched: z.number().int(),
        error: z.string().max(240).nullable(),
      })
    )
    .max(100),
  decisions: z
    .array(
      z.object({
        title: z.string().max(512),
        url: z.string().max(2048).nullable(),
        source: z.string().max(256),
        reason: z.string().max(100),
        score: z.number(),
        selected: z.boolean(),
        readAttempted: z.boolean(),
        beat: z.string().nullable(),
        textChars: z.number().int(),
      })
    )
    .max(300),
});
export type EditorialReport = z.infer<typeof editorialReportSchema>;
