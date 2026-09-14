export const PUBLICATION_CHANNELS = ["all", "website", "email", "social"] as const;
export type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];
export const PUBLICATION_LABELS: Record<PublicationChannel, string> = {
  all: "All publishing",
  website: "New website stories and editions",
  email: "Editorial emails",
  social: "Instagram posts, Stories and comments",
};

/** Triage only. Absence of a match is not legal clearance. Do not treat a match
 * as proof of wrongdoing; an editor must assess the actual context. */
export function sensitiveStoryReasons(text: string): string[] {
  const rules = [
    [
      "Serious allegation or criminal proceeding",
      /\b(?:charged with|accused of|alleg(?:ed|edly|ations?)|arrested|convicted|fraud|bribery|money laundering|sexual assault)\b/i,
    ],
    [
      "Court restriction or protected identity",
      /\b(?:suppression order|non-publication order|closed court|identity (?:is |has been )?(?:suppressed|protected)|child victim|underage victim)\b/i,
    ],
    [
      "Potential commercial relationship",
      /\b(?:sponsored (?:by|content|post)|paid partnership|affiliate link|referral (?:fee|commission)|advertorial)\b/i,
    ],
  ] as const;
  return rules.filter(([, pattern]) => pattern.test(text)).map(([reason]) => reason);
}
