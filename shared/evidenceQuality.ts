import {
  cleanHeadline,
  looksLikeGarbage,
  looksLikeSiteBoilerplate,
  shouldShowSummary,
} from "./headline";
import { foreignHousingHeadline } from "./australianScope";
import { propertyNewsHold } from "./propertyNewsQuality";

type EvidenceInput = {
  title: string;
  summary?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
};
const tidy = (text: string) => text.replace(/\s+/gu, " ").trim();

/** A read projection, never a rewrite of archived source records. No generated prose. */
export function evidenceText(input: EvidenceInput) {
  const title = tidy(cleanHeadline(input.title, input.source ?? undefined));
  let summary = tidy(input.summary ?? "");
  try {
    // Google descriptions may concatenate several publishers' headlines. Even an
    // attributed search result is not an excerpt of the linked article.
    if (new URL(input.sourceUrl ?? "").hostname.toLowerCase() === "news.google.com") summary = "";
  } catch {
    /* Missing URLs do not turn otherwise usable text into an article excerpt. */
  }
  if (looksLikeGarbage(summary) || looksLikeSiteBoilerplate(summary)) summary = "";
  const prefixes = [tidy(input.title), title].filter(Boolean).sort((a, b) => b.length - a.length);
  // Remove exact leading echoes only, retaining the original remaining prose.
  for (let count = 0; count < 8; count++) {
    const prefix = prefixes.find(
      (value) =>
        summary.toLowerCase().startsWith(value.toLowerCase()) &&
        (!summary[value.length] || /^[\s.,:;!?–—-]/u.test(summary[value.length]!))
    );
    if (!prefix) break;
    summary = summary.slice(prefix.length).replace(/^[\s.,:;!?–—-]+/u, "");
  }
  if (summary.toLowerCase() === tidy(input.source ?? "").toLowerCase()) summary = "";
  if (!shouldShowSummary(title, summary)) summary = "";
  return { title, summary };
}

export function evidenceEligible(input: EvidenceInput, asOf: string): boolean {
  return (
    Boolean(input.title.trim()) &&
    !looksLikeGarbage(input.title) &&
    !looksLikeSiteBoilerplate(input.title) &&
    !propertyNewsHold(input, asOf) &&
    !foreignHousingHeadline(input.title, input.sourceUrl, input.source)
  );
}
