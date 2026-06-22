/**
 * Builds the LinkedIn share text for a daily-feed story.
 *
 * Copyright note: this deliberately does NOT include the source publisher's
 * summary/dek. Reposting a publisher's article copy verbatim to a public feed
 * is the kind of reproduction we want to avoid. Instead the draft leads with
 * Ruben's own commentary — the "say this" take, or the "why it matters" line,
 * both LLM-generated on The Desk — plus a factual headline and a link back.
 * A headline is a bare fact; original commentary that references the story is
 * The Desk's own work. Keep every share builder pointed at this one function so
 * the policy stays in a single place.
 */
import { cleanHeadline } from "./headline";
import { SITE_DISPLAY } from "./siteUrl";

export interface ShareDraftInput {
  title: string;
  sayThis?: string | null;
  whyItMatters?: string | null;
}

export function buildStoryShareDraft(item: ShareDraftInput): string {
  // Ruben's own line carries the post. Prefer the punchy "say this", fall back
  // to "why it matters". Never the publisher's summary.
  const take = item.sayThis?.trim() || item.whyItMatters?.trim() || "";
  const parts = [cleanHeadline(item.title)];
  if (take) parts.push("", take);
  parts.push("", `Via The Desk · ${SITE_DISPLAY}`);
  return parts.join("\n").trim();
}
